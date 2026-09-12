import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Section,
  Text,
} from '@react-email/components';
import type { ReactElement } from 'react';
import { emailOriginFrom } from '@/lib/brand';
import {
  EmailFooterNote,
  EmailHeader,
  emailBodyStyle,
  emailCardStyle,
  emailContainerStyle,
  emailFooterStyle,
  emailHeadingStyle,
  emailTextStyle,
} from './_chrome';

/**
 * UAT1 / U4 — aviso INTERNO a Zephyra: una alumna pidió la baja de su cuenta.
 *
 * A diferencia del resto de los correos de esta carpeta, este no va a la
 * alumna: va a la casilla de Zephyra. La baja la ejecuta una persona, porque
 * ninguna alumna puede figurar como `deletedBy` (PDD H-2) — el pedido abre el
 * trámite, no lo cierra.
 */
export interface AccountDeletionRequestProps {
  learnerEmail: string;
  /** ISO 8601 — cuándo se pidió. */
  requestedAt: string;
  /** Origen del sitio, para el encabezado de marca. */
  origin?: string;
}

const formatRequestedAt = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // es-AR con huso de Buenos Aires: el que lee esto está acá.
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(d);
};

export default function AccountDeletionRequest({
  learnerEmail,
  requestedAt,
  origin,
}: AccountDeletionRequestProps): ReactElement {
  const brandOrigin = emailOriginFrom(origin ?? process.env.NEXT_PUBLIC_APP_URL ?? '');
  return (
    <Html lang="es">
      <Head />
      <Body style={emailBodyStyle}>
        <Container style={emailContainerStyle}>
          <EmailHeader origin={brandOrigin} />
          <Section style={emailCardStyle}>
            <Heading style={emailHeadingStyle}>Pedido de baja de cuenta</Heading>
            <Text style={emailTextStyle}>
              <strong>{learnerEmail}</strong> pidió dar de baja su cuenta de la
              Academia.
            </Text>
            <Text style={emailTextStyle}>
              Fecha del pedido: {formatRequestedAt(requestedAt)}.
            </Text>
            <Hr />
            <Text style={emailTextStyle}>
              La cuenta <strong>sigue activa</strong>. El pedido no borra nada
              por sí solo: la baja la procesa una persona del equipo desde el
              panel de administración, y queda registrada a su nombre.
            </Text>
          </Section>
          <Text style={emailFooterStyle}>
            Este aviso es interno y lo generó la Academia al recibir el pedido.
          </Text>
          <EmailFooterNote />
        </Container>
      </Body>
    </Html>
  );
}
