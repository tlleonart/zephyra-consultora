import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Section,
  Text,
} from '@react-email/components';
import type { ReactElement } from 'react';

export type LearnerMagicLinkPurpose =
  | 'learner_activation'
  | 'learner_signin'
  | 'learner_recovery';

export interface LearnerMagicLinkProps {
  magicLinkUrl: string;
  purpose: LearnerMagicLinkPurpose;
  expiresInMinutes: number;
  recipientName?: string;
}

const headingByPurpose: Record<LearnerMagicLinkPurpose, string> = {
  learner_activation: 'Bienvenido a Zephyra',
  learner_signin: 'Tu link de ingreso a Zephyra',
  learner_recovery: 'Recuperá tu acceso a Zephyra',
};

const bodyByPurpose: Record<LearnerMagicLinkPurpose, string> = {
  learner_activation: 'Activá tu cuenta para empezar tus cursos.',
  learner_signin: 'Hacé clic para entrar a tu cuenta.',
  learner_recovery: 'Hacé clic para volver a entrar a tu cuenta.',
};

const ctaByPurpose: Record<LearnerMagicLinkPurpose, string> = {
  learner_activation: 'Activar cuenta',
  learner_signin: 'Iniciar sesión',
  learner_recovery: 'Recuperar acceso',
};

const containerStyle = { maxWidth: '560px', margin: '0 auto', padding: '24px' };
const brandStyle = { color: '#000000', fontSize: '20px', margin: '0 0 16px' };
const headingStyle = { color: '#000000', fontSize: '24px', margin: '0 0 16px' };
const textStyle = { color: '#000000', fontSize: '16px', lineHeight: '24px' };
const buttonStyle = {
  backgroundColor: '#000000',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '4px',
  textDecoration: 'none',
  fontSize: '16px',
  display: 'inline-block',
};
const footerStyle = { color: '#555555', fontSize: '12px', lineHeight: '18px' };

export const LearnerMagicLink = ({
  magicLinkUrl,
  purpose,
  expiresInMinutes,
  recipientName,
}: LearnerMagicLinkProps): ReactElement => {
  const greeting = recipientName ? `Hola ${recipientName},` : 'Hola,';

  return (
    <Html lang="es">
      <Head />
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
        <Container style={containerStyle}>
          <Heading as="h2" style={brandStyle}>Zephyra</Heading>
          <Heading as="h1" style={headingStyle}>{headingByPurpose[purpose]}</Heading>
          <Text style={textStyle}>{greeting}</Text>
          <Text style={textStyle}>{bodyByPurpose[purpose]}</Text>
          <Section style={{ margin: '24px 0' }}>
            <Button href={magicLinkUrl} style={buttonStyle}>
              {ctaByPurpose[purpose]}
            </Button>
          </Section>
          <Hr style={{ borderColor: '#dddddd', margin: '24px 0' }} />
          <Text style={footerStyle}>
            {`Este link expira en ${expiresInMinutes} minutos.`}
          </Text>
          <Text style={footerStyle}>
            Si no solicitaste este mensaje podés ignorarlo.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default LearnerMagicLink;
