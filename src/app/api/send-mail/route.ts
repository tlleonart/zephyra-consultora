import { NextRequest, NextResponse } from "next/server";
import { createTransport } from "nodemailer";
import { Resend } from "resend";

const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Zephyra <no-reply@zephyraconsultora.com>";

interface SendEmailRequestBody {
  name: string;
  email: string;
  content: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: SendEmailRequestBody = await req.json();

    const { name, email, content } = body;

    if (!name || !email || !content) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

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

    return NextResponse.json({ message: "Envio satisfactorio" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
