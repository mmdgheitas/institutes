import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from '@/components/providers/Providers';

const vazirmatn = localFont({
  src: [
    { path: '../../public/fonts/Vazirmatn-FD-NL-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Vazirmatn-FD-NL-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/Vazirmatn-FD-NL-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/Vazirmatn-FD-NL-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../../public/fonts/Vazirmatn-FD-NL-ExtraBold.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-vazirmatn',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'سامانه مدیریت آموزشگاه‌ها',
    template: '%s | سامانه مدیریت آموزشگاه‌ها',
  },
  description: 'پنل مدیریت آموزشگاه‌ها و سامانه‌ی سراسری',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563EB',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
