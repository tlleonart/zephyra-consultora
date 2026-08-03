// Renders the three templates to real HTML and writes them out, so the band, the
// lockup URL and the absence of a literal host can be inspected rather than
// asserted. Runs inside the academia vitest project so the @/ alias and
// @react-email/render resolve exactly as they do in production.
import { it } from 'vitest';
import fs from 'node:fs';
import { render } from '@react-email/components';
import { LearnerMagicLink } from '@/emails/LearnerMagicLink';
import { SeatInvite } from '@/emails/SeatInvite';

const OUT = process.env.EMAIL_OUT!;

it('renders LearnerMagicLink', async () => {
  const html = await render(
    LearnerMagicLink({
      magicLinkUrl: 'http://localhost:3117/cursos/auth/verify?token=demo',
      purpose: 'learner_activation',
      expiresInMinutes: 30,
      recipientName: 'María',
    })
  );
  fs.writeFileSync(`${OUT}/email-magiclink.html`, html);
});

it('renders SeatInvite', async () => {
  const html = await render(
    SeatInvite({
      claimUrl: 'http://localhost:3117/empresa/invitacion?token=demo',
      organizationName: 'Zephyra',
      courseTitle: 'Diversidad, Equidad e Inclusión',
      expiresInDays: 7,
    })
  );
  fs.writeFileSync(`${OUT}/email-seatinvite.html`, html);
});
