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

// Seat-invite email (Sprint 3b Phase C1). The org Owner Admin invites an
// employee to claim a seat for a course; the claimUrl carries the opaque invite
// token + claimRequestId + (org, seatPack) context (composed by the Next.js
// server action from convex requestSeatInvite's returned rawToken/claimRequestId).
export interface SeatInviteProps {
  claimUrl: string;
  organizationName: string;
  courseTitle: string;
  expiresInDays: number;
}

export const SeatInvite = ({
  claimUrl,
  organizationName,
  courseTitle,
  expiresInDays,
}: SeatInviteProps): ReactElement => {
  // The host comes from the claim link itself — never a literal.
  const origin = emailOriginFrom(claimUrl);

  return (
    <Html lang="es">
      <Head />
      <Body style={emailBodyStyle}>
        <Container style={emailContainerStyle}>
          <EmailHeader origin={origin} />
          <Section style={emailCardStyle}>
            <Heading as="h1" style={emailHeadingStyle}>
              Te invitaron a un curso
            </Heading>
            <Text style={emailTextStyle}>Hola,</Text>
            <Text style={emailTextStyle}>
              {`${organizationName} te asignó un lugar en el curso `}
              <strong>{courseTitle}</strong>
              {' en Academia Zephyra. Hacé clic para activar tu acceso y empezar.'}
            </Text>
            <Section style={{ margin: '24px 0' }}>
              <Button href={claimUrl} style={emailButtonStyle}>
                Activar mi acceso
              </Button>
            </Section>
            <Hr style={{ borderColor: EMAIL_PALETTE.border, margin: '24px 0' }} />
            <Text style={emailFooterStyle}>
              {`Esta invitación expira en ${expiresInDays} días.`}
            </Text>
            <Text style={emailFooterStyle}>
              Si no esperabas esta invitación podés descartar este mensaje.
            </Text>
            <EmailFooterNote />
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default SeatInvite;
