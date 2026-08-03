import { Img, Section, Text } from '@react-email/components';
import type { ReactElement } from 'react';
import { BRAND_ORIGIN_LINE, EMAIL_PALETTE, brandEmailLockup } from '@/lib/brand';

/**
 * Shared email chrome for the two React Email templates (guide §8.4).
 *
 * WHY A BAND BUILT FROM bgcolor AND NOT A BACKGROUND IMAGE. Outlook (Windows,
 * the Word rendering engine) drops CSS background-image, and every major client
 * blocks remote images by default on first open. A band that only exists as an
 * image is therefore a WHITE band for a large share of recipients — i.e. the
 * brand disappears exactly when the recipient is deciding whether the mail is
 * legitimate. So the green comes from the table cell's own background colour,
 * which is the one thing every client honours, and the lockup image sits ON it
 * with alt text. Images off ⇒ green band + "Academia Zephyra" in sand. Images on
 * ⇒ green band + the lockup. Neither state is broken.
 *
 * The pre-composed public/images/brand/email-header-green-band-1200x320.png is
 * deliberately NOT used for the same reason: it bakes the band into the image,
 * so with images blocked there is nothing left.
 *
 * @param origin absolute origin, derived by the caller from the URL it was
 *               handed. Never a literal host — see @/lib/brand.
 */
export function EmailHeader({ origin }: { origin: string }): ReactElement {
  const lockup = brandEmailLockup(origin);
  return (
    <Section
      style={{
        backgroundColor: EMAIL_PALETTE.green,
        padding: '28px 32px',
        borderRadius: '12px 12px 0 0',
      }}
    >
      <Img
        src={lockup.src}
        alt={lockup.alt}
        width={lockup.width}
        height={lockup.height}
        style={{
          display: 'block',
          border: '0',
          height: `${lockup.height}px`,
          width: 'auto',
          // The fallback when the image is blocked: the alt text renders in
          // sand on the green band at 9.10:1, not as invisible black-on-green.
          color: EMAIL_PALETTE.sand,
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '19px',
          fontWeight: 600,
        }}
      />
    </Section>
  );
}

/** The card the message body sits in — above paper, per the Arena surfaces. */
export const emailBodyStyle = {
  backgroundColor: EMAIL_PALETTE.paper,
  fontFamily: 'Georgia, "Times New Roman", serif',
  margin: '0',
  padding: '24px 0',
} as const;

export const emailContainerStyle = {
  maxWidth: '560px',
  margin: '0 auto',
} as const;

export const emailCardStyle = {
  backgroundColor: EMAIL_PALETTE.card,
  border: `1px solid ${EMAIL_PALETTE.border}`,
  borderTop: 'none',
  borderRadius: '0 0 12px 12px',
  padding: '32px',
} as const;

/** Serif display, matching the brand's Playfair gesture with an email-safe stack. */
export const emailHeadingStyle = {
  color: EMAIL_PALETTE.green,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '24px',
  lineHeight: '1.25',
  fontWeight: 600,
  margin: '0 0 16px',
} as const;

/** Body copy uses a sans stack: DM Sans is not installable in email. */
export const emailTextStyle = {
  color: EMAIL_PALETTE.text,
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 12px',
} as const;

/** The CTA. Green fill / white text = 12.06:1. */
export const emailButtonStyle = {
  backgroundColor: EMAIL_PALETTE.green,
  color: '#FFFFFF',
  fontFamily: 'Helvetica, Arial, sans-serif',
  padding: '14px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '16px',
  fontWeight: 600,
  display: 'inline-block',
} as const;

export const emailFooterStyle = {
  color: EMAIL_PALETTE.textSecondary,
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 0 6px',
} as const;

/** "Una iniciativa de Zephyra" — the §8.4 back-reference, never an agency credit. */
export function EmailFooterNote(): ReactElement {
  return <Text style={emailFooterStyle}>{BRAND_ORIGIN_LINE}</Text>;
}
