import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../blocs/auth/auth_bloc.dart';
import '../../../core/theme/app_theme.dart';
import '../../widgets/common.dart';

/// Phone + OTP sign-in, with an optional password path.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _codeController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  bool _usePassword = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    _nameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BlocConsumer<AuthBloc, AuthState>(
        listenWhen: (AuthState prev, AuthState next) =>
            prev.error != next.error && next.error != null,
        listener: (BuildContext context, AuthState state) {
          final String? error = state.error;
          if (error != null) showErrorSnack(context, error);

          // Prefill the dev code so local testing needs no SMS gateway.
          final String? devCode = state.devOtpCode;
          if (devCode != null && _codeController.text.isEmpty) {
            _codeController.text = devCode;
          }
        },
        builder: (BuildContext context, AuthState state) {
          final bool awaitingCode = state.otpSentTo != null;

          return SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      const SizedBox(height: 24),
                      Icon(
                        Icons.school_rounded,
                        size: 64,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Find your next course',
                        textAlign: TextAlign.center,
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Discover institutes near you, pre-register online and '
                        'study anywhere.',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                      ),
                      const SizedBox(height: 36),
                      if (awaitingCode)
                        ..._buildCodeStep(state)
                      else if (_usePassword)
                        ..._buildPasswordStep(state)
                      else
                        ..._buildPhoneStep(state),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  List<Widget> _buildPhoneStep(AuthState state) {
    return <Widget>[
      TextField(
        controller: _phoneController,
        keyboardType: TextInputType.phone,
        autofillHints: const <String>[AutofillHints.telephoneNumber],
        inputFormatters: <TextInputFormatter>[
          FilteringTextInputFormatter.allow(RegExp(r'[\d+\s۰-۹٠-٩-]')),
        ],
        decoration: const InputDecoration(
          labelText: 'Mobile number',
          hintText: '09xxxxxxxxx',
          prefixIcon: Icon(Icons.phone_outlined),
        ),
      ),
      const SizedBox(height: 16),
      FilledButton(
        onPressed: state.isSubmitting
            ? null
            : () => context
                .read<AuthBloc>()
                .add(OtpRequested(_phoneController.text)),
        child: state.isSubmitting
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Text('Send verification code'),
      ),
      const SizedBox(height: 12),
      TextButton(
        onPressed: () => setState(() => _usePassword = true),
        child: const Text('Sign in with a password instead'),
      ),
    ];
  }

  List<Widget> _buildCodeStep(AuthState state) {
    return <Widget>[
      Text(
        'We sent a code to ${state.otpSentTo}',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodyMedium,
      ),
      if (state.devOtpCode != null) ...<Widget>[
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppTheme.warning.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            'Development mode — code: ${state.devOtpCode}',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
      ],
      const SizedBox(height: 20),
      TextField(
        controller: _codeController,
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        maxLength: 8,
        style: const TextStyle(fontSize: 24, letterSpacing: 8),
        decoration: const InputDecoration(
          counterText: '',
          hintText: '·····',
        ),
      ),
      if (state.requiresName) ...<Widget>[
        const SizedBox(height: 12),
        TextField(
          controller: _nameController,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(
            labelText: 'Your full name',
            prefixIcon: Icon(Icons.person_outline),
          ),
        ),
      ],
      const SizedBox(height: 20),
      FilledButton(
        onPressed: state.isSubmitting
            ? null
            : () => context.read<AuthBloc>().add(
                  OtpSubmitted(
                    code: _codeController.text,
                    fullName: _nameController.text.trim().isEmpty
                        ? null
                        : _nameController.text.trim(),
                  ),
                ),
        child: state.isSubmitting
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Text('Verify and continue'),
      ),
      const SizedBox(height: 12),
      TextButton(
        onPressed: () {
          _codeController.clear();
          context.read<AuthBloc>().add(const OtpFlowReset());
        },
        child: const Text('Use a different number'),
      ),
    ];
  }

  List<Widget> _buildPasswordStep(AuthState state) {
    return <Widget>[
      TextField(
        controller: _phoneController,
        keyboardType: TextInputType.phone,
        decoration: const InputDecoration(
          labelText: 'Mobile number',
          prefixIcon: Icon(Icons.phone_outlined),
        ),
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _passwordController,
        obscureText: true,
        decoration: const InputDecoration(
          labelText: 'Password',
          prefixIcon: Icon(Icons.lock_outline),
        ),
      ),
      const SizedBox(height: 20),
      FilledButton(
        onPressed: state.isSubmitting
            ? null
            : () => context.read<AuthBloc>().add(
                  PasswordLoginSubmitted(
                    phone: _phoneController.text,
                    password: _passwordController.text,
                  ),
                ),
        child: state.isSubmitting
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Text('Sign in'),
      ),
      const SizedBox(height: 12),
      TextButton(
        onPressed: () => setState(() => _usePassword = false),
        child: const Text('Use a verification code instead'),
      ),
    ];
  }
}
