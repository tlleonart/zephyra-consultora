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
import { EMAIL_PALETTE, emailOriginFrom } from '@/lib/brand';
import {
  EmailFooterNote,
  EmailHeader,
  emailBodyStyle,
  emailButtonStyle,
  emailCardStyle,
  emailContainerStyle,
  emailFooterStyle,
  emailHeadingStyle,
  emailTextStyle,
} from './_chrome';

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

// Naming, enforced by test: "Academia Zephyra". The old copy said only
// "Zephyra", which is the institutional consultancy — a learner receiving a
// course-access link should be told which product it belongs to.
const headingByPurpose: Record<LearnerMagicLinkPurpose, string> = {
  learner_activation: 'Bienvenido a Academia Zephyra',
  learner_signin: 'Tu link de ingreso a Academia Zephyra',
  learner_recovery: 'Recuperá tu acceso a Academia Zephyra',
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

export const LearnerMagicLink = ({
  magicLinkUrl,
  purpose,
  expiresInMinutes,
  recipientName,
}: LearnerMagicLinkProps): ReactElement => {
  const greeting = recipientName ? `Hola ${recipientName},` : 'Hola,';
  // The host comes from the link this template was handed — never a literal.
  const origin = emailOriginFrom(magicLinkUrl);

  return (
    <Html lang="es">
      <Head />
      <Body style={emailBodyStyle}>
        <Container style={emailContainerStyle}>
          <EmailHeader origin={origin} />
          <Section style={emailCardStyle}>
            <Heading as="h1" style={emailHeadingStyle}>
              {headingByPurpose[purpose]}
            </Heading>
            <Text style={emailTextStyle}>{greeting}</Text>
            <Text style={emailTextStyle}>{bodyByPurpose[purpose]}</Text>
            <Section style={{ margin: '24px 0' }}>
              <Button href={magicLinkUrl} style={emailButtonStyle}>
                {ctaByPurpose[purpose]}
              </Button>
            </Section>
            <Hr style={{ borderColor: EMAIL_PALETTE.border, margin: '24px 0' }} />
            <Text style={emailFooterStyle}>
              {`Este link expira en ${expiresInMinutes} minutos.`}
            </Text>
            <Text style={emailFooterStyle}>
              Si no solicitaste este mensaje podés ignorarlo.
            </Text>
            <EmailFooterNote />
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default LearnerMagicLink;
