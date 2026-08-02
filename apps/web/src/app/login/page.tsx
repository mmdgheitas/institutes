'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Phone, ShieldCheck, Loader2, MessageSquareText, UserPlus } from 'lucide-react';
import { useSession } from '@/stores/session';
import { errorMessage } from '@/stores/toasts';
import { auth } from '@/lib/api/endpoints';
import { validateOtp, validatePassword, validatePhone, validateEmail } from '@/lib/validation';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { toPersianDigits } from '@/lib/format';

export default function LoginPage() {
  const router = useRouter();
  const { applyAuth, user } = useSession();
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpSentMessage, setOtpSentMessage] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  // Registration form state.
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    role: 'INSTITUTE_ADMIN',
  });

  // Already signed in → go to the console.
  useEffect(() => {
    if (user) router.replace('/');
  }, [user, router]);

  const passwordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const phoneError = validatePhone(phone);
    if (phoneError) nextErrors.phone = phoneError;
    const password = (event.currentTarget as HTMLFormElement).password.value;
    const passwordError = validatePassword(password);
    if (passwordError) nextErrors.password = passwordError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await auth.login({ phone: phone.replace(/[\s-]/g, ''), password });
      applyAuth(response.accessToken, response.refreshToken, response.user);
      router.replace(response.user.role === 'STUDENT' ? '/student' : '/');
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const requestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    const phoneError = validatePhone(phone);
    if (phoneError) {
      setErrors({ phone: phoneError });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const response = await auth.requestOtp({ phone: phone.replace(/[\s-]/g, '') });
      setOtpRequested(true);
      setOtpSentMessage(`کد تأیید ارسال شد. کد تا ${toPersianDigits(Math.round(response.expiresInSeconds / 60))} دقیقه معتبر است.`);
      // In dev the API returns the code so the console is usable without SMS.
      if (response.devCode) setDevCode(response.devCode);
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = (event.currentTarget as HTMLFormElement).otpCode.value;
    const codeError = validateOtp(code);
    if (codeError) {
      setErrors({ otpCode: codeError });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const response = await auth.verifyOtp({ phone: phone.replace(/[\s-]/g, ''), code });
      applyAuth(response.accessToken, response.refreshToken, response.user);
      router.replace(response.user.role === 'STUDENT' ? '/student' : '/');
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (registerForm.fullName.trim().length < 2) nextErrors.fullName = 'نام کامل حداقل ۲ کاراکتر است';
    const phoneError = validatePhone(registerForm.phone);
    if (phoneError) nextErrors.phone = phoneError;
    const passwordError = validatePassword(registerForm.password);
    if (passwordError) nextErrors.password = passwordError;
    if (registerForm.email) {
      const emailError = validateEmail(registerForm.email);
      if (emailError) nextErrors.email = emailError;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await auth.register({
        phone: registerForm.phone.replace(/[\s-]/g, ''),
        fullName: registerForm.fullName.trim(),
        password: registerForm.password,
        email: registerForm.email.trim() || undefined,
        role: registerForm.role,
      });
      applyAuth(response.accessToken, response.refreshToken, response.user);
      // Institute admins land on institute registration; students go to the app notice.
      router.replace(response.user.role === 'INSTITUTE_ADMIN' ? '/institute/new' : '/student');
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-600/30">
            <GraduationCap className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">سامانه مدیریت آموزشگاه‌ها</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              ورود به پنل مدیریت آموزشگاه و کنسول مدیر سامانه
            </p>
          </div>
        </div>

        <div className="rounded-card border border-slate-200 bg-white p-6 shadow-card">
          <Tabs
            defaultTab="password"
            tabs={[
              {
                id: 'password',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    ورود با رمز عبور
                  </span>
                ),
                content: (
                  <form onSubmit={passwordLogin} className="flex flex-col gap-4">
                    <Input
                      label="شماره موبایل"
                      latin
                      placeholder="09121234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      error={errors.phone}
                      required
                      autoComplete="username"
                    />
                    <Input
                      label="رمز عبور"
                      latin
                      type="password"
                      name="password"
                      placeholder="••••••••"
                      error={errors.password}
                      required
                      autoComplete="current-password"
                    />
                    {errors.form && (
                      <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">{errors.form}</p>
                    )}
                    <Button type="submit" size="lg" loading={submitting}>
                      ورود
                    </Button>
                    <p className="text-center text-xs text-slate-400">
                      حساب‌های نمونه: مدیر سامانه <span className="font-mono" dir="ltr">09120000001</span> ·
                      مدیر آموزشگاه <span className="font-mono" dir="ltr">09121000000</span> · رمز همه حساب‌ها{' '}
                      <span className="font-mono" dir="ltr">Password123</span>
                    </p>
                  </form>
                ),
              },
              {
                id: 'otp',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquareText className="h-4 w-4" />
                    ورود با کد یکبارمصرف
                  </span>
                ),
                content: (
                  <form
                    onSubmit={otpRequested ? verifyOtp : requestOtp}
                    className="flex flex-col gap-4"
                  >
                    <Input
                      label="شماره موبایل"
                      latin
                      placeholder="09121234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      error={errors.phone}
                      required
                      disabled={otpRequested}
                    />
                    {otpRequested ? (
                      <>
                        <Input
                          label="کد تأیید"
                          latin
                          name="otpCode"
                          placeholder="11111"
                          error={errors.otpCode}
                          required
                          autoFocus
                        />
                        <p className="rounded-lg bg-secondary-50 px-3 py-2 text-xs leading-5 text-secondary-800">
                          {otpSentMessage}
                          {devCode && (
                            <span className="mt-1 block">
                              کد توسعه (غیر از محیط تولید):{' '}
                              <b className="font-mono" dir="ltr">{toPersianDigits(devCode)}</b>
                            </span>
                          )}
                        </p>
                      </>
                    ) : (
                      <Button type="submit" size="lg" loading={submitting}>
                        ارسال کد
                      </Button>
                    )}
                    {otpRequested && (
                      <>
                        {errors.form && (
                          <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">{errors.form}</p>
                        )}
                        <Button type="submit" size="lg" loading={submitting}>
                          تأیید و ورود
                        </Button>
                        <button
                          type="button"
                          className="text-xs text-primary-600 hover:underline"
                          onClick={() => {
                            setOtpRequested(false);
                            setDevCode(null);
                          }}
                        >
                          تغییر شماره موبایل
                        </button>
                      </>
                    )}
                  </form>
                ),
              },
              {
                id: 'register',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <UserPlus className="h-4 w-4" />
                    ساخت حساب
                  </span>
                ),
                content: (
                  <form onSubmit={register} className="flex flex-col gap-4">
                    <Input
                      label="نام و نام خانوادگی"
                      value={registerForm.fullName}
                      error={errors.fullName}
                      onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                      required
                      autoComplete="name"
                    />
                    <Input
                      label="شماره موبایل"
                      latin
                      placeholder="09121234567"
                      value={registerForm.phone}
                      error={errors.phone}
                      onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      required
                      autoComplete="username"
                    />
                    <Input
                      label="ایمیل (اختیاری)"
                      latin
                      type="email"
                      value={registerForm.email}
                      error={errors.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      autoComplete="email"
                    />
                    <Input
                      label="رمز عبور (حداقل ۸ کاراکتر)"
                      latin
                      type="password"
                      value={registerForm.password}
                      error={errors.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      required
                      autoComplete="new-password"
                    />
                    <Select
                      label="نوع حساب"
                      value={registerForm.role}
                      onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}
                    >
                      <option value="INSTITUTE_ADMIN">مدیر آموزشگاه</option>
                      <option value="STUDENT">دانش‌آموز (اپلیکیشن موبایل)</option>
                    </Select>
                    {errors.form && (
                      <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">{errors.form}</p>
                    )}
                    <Button type="submit" size="lg" loading={submitting}>
                      ساخت حساب
                    </Button>
                  </form>
                ),
              },
            ]}
          />
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <Phone className="h-3.5 w-3.5" />
          در صورت نیاز به پشتیبانی با مدیر سامانه تماس بگیرید
        </p>

        {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('expired') && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
            <Loader2 className="h-3.5 w-3.5" />
            نشست شما منقضی شده است؛ دوباره وارد شوید.
          </div>
        )}
      </div>
    </main>
  );
}
