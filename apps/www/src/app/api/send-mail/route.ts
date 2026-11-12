import { NextRequest, NextResponse } from "next/server";
import { createTransport } from "nodemailer";
import { Resend } from "resend";
import {
  checkContactBody,
  clientIp,
  createIpLimiter,
} from "@/lib/contact-guard";

const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Zephyra <no-reply@zephyraconsultora.com>";

const SUCCESS_BODY = { message: "Envio satisfactorio" };

// Per-instance memory: see the limitation note in lib/contact-guard.ts.
const ipLimiter = createIpLimiter();

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const check = checkContactBody(body);
    if (check.kind === "honeypot") {
      // Dropped without sending; same reply as a real send.
      return NextResponse.json(SUCCESS_BODY);
    }
    if (check.kind === "invalid") {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    if (!ipLimiter.allow(clientIp(req.headers))) {
      return NextResponse.json(
        { error: "Demasiados envíos. Probá de nuevo más tarde." },
        { status: 429 }
      );
    }

    const { name, email, content } = check.message;

    const subject = `Nuevo contacto: ${name}`;
    const text = `Nuevo contacto de ${name} (${email}):\n\n${content}`;
    const to = "info@zephyraconsultora.com";

    // Primary: Resend. Fallback: legacy Ferozo SMTP when RESEND_API_KEY absent.
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: EMAIL_FROM,
        replyTo: email,
        to,
        subject,
        text,
      });
      if (error) {
        throw new Error(
          `Resend send failed: ${error.message ?? JSON.stringify(error)}`
        );
      }
    } else {
      const transporter = createTransport({
        host: "c2810738.ferozo.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
      await transporter.sendMail({
        from: `"Contacto Zephyra" <${process.env.EMAIL_USER}>`,
        replyTo: email,
        to,
        subject,
        text,
      });
    }

    return NextResponse.json(SUCCESS_BODY);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
