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

export const SeatInvite = ({
  claimUrl,
  organizationName,
  courseTitle,
  expiresInDays,
}: SeatInviteProps): ReactElement => {
  return (
    <Html lang="es">
      <Head />
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
        <Container style={containerStyle}>
          <Heading as="h2" style={brandStyle}>Zephyra</Heading>
          <Heading as="h1" style={headingStyle}>Te invitaron a un curso</Heading>
          <Text style={textStyle}>Hola,</Text>
          <Text style={textStyle}>
            {`${organizationName} te asignó un lugar en el curso `}
            <strong>{courseTitle}</strong>
            {'. Hacé clic para activar tu acceso y empezar.'}
          </Text>
          <Section style={{ margin: '24px 0' }}>
            <Button href={claimUrl} style={buttonStyle}>
              Activar mi acceso
            </Button>
          </Section>
          <Hr style={{ borderColor: '#dddddd', margin: '24px 0' }} />
          <Text style={footerStyle}>
            {`Esta invitación expira en ${expiresInDays} días.`}
          </Text>
          <Text style={footerStyle}>
            Si no esperabas esta invitación podés descartar este mensaje.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default SeatInvite;
