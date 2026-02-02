import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Restablecer Contraseña - Zephyra Consultora',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
