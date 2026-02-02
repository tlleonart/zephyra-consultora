'use client';

import { useState } from 'react';
import styles from './ContactoPage.module.css';

export default function ContactoPage() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormState((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission - in production, this would send to an API
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsSubmitting(false);
    setSubmitted(true);
    setFormState({ name: '', email: '', company: '', message: '' });
  };

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <h1 className={styles.title}>Contacto</h1>
          <p className={styles.subtitle}>
            Estamos aqui para ayudarte a alcanzar tus objetivos de sostenibilidad.
          </p>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.container}>
          <div className={styles.grid}>
            {/* Contact Info */}
            <div className={styles.info}>
              <h2 className={styles.infoTitle}>Hablemos</h2>
              <p className={styles.infoText}>
                ¿Tienes un proyecto en mente? ¿Quieres saber mas sobre nuestros
                servicios? Completa el formulario y nos pondremos en contacto
                contigo.
              </p>

              <div className={styles.contactMethods}>
                <div className={styles.contactMethod}>
                  <span className={styles.contactIcon}>
                    <span className="material-icons">email</span>
                  </span>
                  <div>
                    <h3 className={styles.contactLabel}>Email</h3>
                    <a
                      href="mailto:info@zephyraconsultora.com"
                      className={styles.contactValue}
                    >
                      info@zephyraconsultora.com
                    </a>
                  </div>
                </div>

                <div className={styles.contactMethod}>
                  <span className={styles.contactIcon}>
                    <span className="material-icons">location_on</span>
                  </span>
                  <div>
                    <h3 className={styles.contactLabel}>Ubicacion</h3>
                    <p className={styles.contactValue}>Rosario, Argentina</p>
                  </div>
                </div>

                <div className={styles.contactMethod}>
                  <span className={styles.contactIcon}>
                    <span className="material-icons">schedule</span>
                  </span>
                  <div>
                    <h3 className={styles.contactLabel}>Horario</h3>
                    <p className={styles.contactValue}>Lun - Vie: 9:00 - 18:00</p>
                  </div>
                </div>
              </div>

              <div className={styles.social}>
                <h3 className={styles.socialTitle}>Seguinos</h3>
                <div className={styles.socialLinks}>
                  <a
                    href="https://www.linkedin.com/company/zephyra-consultora/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                    aria-label="LinkedIn"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.instagram.com/zephyra.consultora/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                    aria-label="Instagram"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className={styles.formWrapper}>
              {submitted ? (
                <div className={styles.success}>
                  <span className={styles.successIcon}>
                    <span className="material-icons">check_circle</span>
                  </span>
                  <h3 className={styles.successTitle}>¡Mensaje enviado!</h3>
                  <p className={styles.successText}>
                    Gracias por contactarnos. Te responderemos a la brevedad.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className={styles.successButton}
                  >
                    Enviar otro mensaje
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className={styles.formGroup}>
                    <label htmlFor="name" className={styles.label}>
                      Nombre *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formState.name}
                      onChange={handleChange}
                      required
                      className={styles.input}
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="email" className={styles.label}>
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formState.email}
                      onChange={handleChange}
                      required
                      className={styles.input}
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="company" className={styles.label}>
                      Organizacion
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      value={formState.company}
                      onChange={handleChange}
                      className={styles.input}
                      placeholder="Nombre de tu organizacion"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="message" className={styles.label}>
                      Mensaje *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formState.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      className={styles.textarea}
                      placeholder="¿En que podemos ayudarte?"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={styles.submitButton}
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar mensaje'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
