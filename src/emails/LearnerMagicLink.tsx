import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
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
  recipientName?: string;
}

const headingByPurpose: Record<LearnerMagicLinkPurpose, string> = {
  learner_activation: 'Activá tu cuenta',
  learner_signin: 'Ingresá a tu cuenta',
  learner_recovery: 'Recuperá tu acceso',
};

const bodyByPurpose: Record<LearnerMagicLinkPurpose, string> = {
  learner_activation:
    'Te damos la bienvenida a Zephyra. Hacé clic en el botón para activar tu cuenta y comenzar a aprender.',
  learner_signin:
    'Solicitaste ingresar a tu cuenta. Hacé clic en el botón para acceder.',
  learner_recovery:
    'Solicitaste recuperar el acceso a tu cuenta. Hacé clic en el botón para continuar.',
};

export const LearnerMagicLink = ({
  magicLinkUrl,
  purpose,
  recipientName,
}: LearnerMagicLinkProps): ReactElement => {
  const greeting = recipientName ? `Hola ${recipientName},` : 'Hola,';

  return (
    <Html lang="es">
      <Head />
      <Body>
        <Container>
          <Heading>{headingByPurpose[purpose]}</Heading>
          <Text>{greeting}</Text>
          <Text>{bodyByPurpose[purpose]}</Text>
          <Button href={magicLinkUrl}>Continuar</Button>
          <Text>Si no reconocés esta solicitud, podés ignorar este correo.</Text>
        </Container>
      </Body>
    </Html>
  );
};

export default LearnerMagicLink;
