import { LoginForm } from '@/features/auth/components/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Iniciar Sesión - Zephyra Consultora',
};

export default function LoginPage() {
  return <LoginForm />;
}
