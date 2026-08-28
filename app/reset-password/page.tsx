"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Wallet,
  Sun,
  Moon,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/utils/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup" | "recovery">("login");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("meu-financeiro-theme");

    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        window.location.href = "/";
      }
    });
  }, []);

  function changeMode(
    next: "login" | "signup" | "recovery"
  ) {
    setMode(next);
    setError("");
    setMessage("");
    setSenha("");
    setConfirmarSenha("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function changeTheme(next: "dark" | "light") {
    setTheme(next);
    localStorage.setItem("meu-financeiro-theme", next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();

    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Digite seu e-mail.");
      return;
    }

    if (mode === "signup") {
      if (!nome.trim()) {
        setError("Digite seu nome.");
        return;
      }

      if (senha.length < 6) {
        setError("A senha precisa ter pelo menos 6 caracteres.");
        return;
      }

      if (senha !== confirmarSenha) {
        setError("As senhas não são iguais.");
        return;
      }
    }

    if (mode === "login" && !senha) {
      setError("Digite sua senha.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: senha,
        });

        if (error) {
          setError("E-mail ou senha incorretos.");
          return;
        }

        window.location.href = "/";
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: senha,
          options: {
            data: {
              nome: nome.trim(),
              name: nome.trim(),
            },
          },
        });

        if (error) {
          setError(error.message);
          return;
        }

        if (data.session) {
          window.location.href = "/";
          return;
        }

        setMessage(
          "Cadastro realizado! Confira seu e-mail para confirmar sua conta."
        );

        setMode("login");
        setSenha("");
        setConfirmarSenha("");
        return;
      }

      const { error } =
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/login`,
        });

      if (error) {
        setError(error.message);
        return;
      }

      setMessage(
        "Enviamos um link para redefinir sua senha. Confira seu e-mail."
      );
    } finally {
      setLoading(false);
    }
  }

  const isDark = theme === "dark";

  return (
    <main className={`login-page ${isDark ? "dark" : "light"}`}>
      <div className="glow glow-one" />
      <div className="glow glow-two" />
      <div className="grid-bg" />

      {/* TEMA */}
      <div className="theme-switch">
        <button
          type="button"
          aria-label="Tema claro"
          className={theme === "light" ? "active" : ""}
          onClick={() => changeTheme("light")}
        >
          <Sun size={16} />
        </button>

        <button
          type="button"
          aria-label="Tema escuro"
          className={theme === "dark" ? "active" : ""}
          onClick={() => changeTheme("dark")}
        >
          <Moon size={16} />
        </button>
      </div>

      <section className="login-container">

        {/* MARCA */}
        <div className="brand">
          <div className="brand-logo">
            <Wallet size={25} strokeWidth={2.2} />
          </div>

          <div>
            <h1>Meu Financeiro</h1>
            <p>controle pessoal</p>
          </div>
        </div>

        {/* CARD */}
        <div className="login-card">

          <div className="heading">
            <h2>
              {mode === "login"
                ? "Acesse sua conta"
                : mode === "signup"
                ? "Crie sua conta"
                : "Recuperar senha"}
            </h2>

            <p>
              {mode === "login"
                ? "Entre para continuar no seu controle financeiro."
                : mode === "signup"
                ? "Crie seu acesso e organize sua vida financeira."
                : "Digite seu e-mail para recuperar o acesso."}
            </p>
          </div>

          {error && (
            <div className="alert error">
              {error}
            </div>
          )}

          {message && (
            <div className="alert success">
              {message}
            </div>
          )}

          <form onSubmit={submit}>

            {mode === "signup" && (
              <label>
                <span>Nome</span>

                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  autoComplete="name"
                />
              </label>
            )}

            <label>
              <span>E-mail</span>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@email.com"
                autoComplete="email"
              />
            </label>

            {mode !== "recovery" && (
              <label>
                <span>Senha</span>

                <div className="password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete={
                      mode === "login"
                        ? "current-password"
                        : "new-password"
                    }
                  />

                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? "Ocultar senha"
                        : "Mostrar senha"
                    }
                    onClick={() =>
                      setShowPassword((value) => !value)
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </label>
            )}

            {mode === "signup" && (
              <label>
                <span>Confirmar senha</span>

                <div className="password-wrap">
                  <input
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    value={confirmarSenha}
                    onChange={(e) =>
                      setConfirmarSenha(e.target.value)
                    }
                    placeholder="Digite a senha novamente"
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    aria-label={
                      showConfirmPassword
                        ? "Ocultar senha"
                        : "Mostrar senha"
                    }
                    onClick={() =>
                      setShowConfirmPassword(
                        (value) => !value
                      )
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </label>
            )}

            {mode === "login" && (
              <div className="forgot">
                <button
                  type="button"
                  onClick={() => changeMode("recovery")}
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            <button
              className="submit"
              disabled={loading}
              type="submit"
            >
              <span>
                {loading
                  ? "Aguarde..."
                  : mode === "login"
                  ? "Entrar"
                  : mode === "signup"
                  ? "Criar minha conta"
                  : "Enviar link"}
              </span>

              {!loading && (
                <ArrowRight size={18} />
              )}
            </button>
          </form>

          <div className="switch">
            {mode === "login" && (
              <>
                <span>Ainda não tem uma conta?</span>
                <button
                  type="button"
                  onClick={() => changeMode("signup")}
                >
                  Criar conta
                </button>
              </>
            )}

            {mode === "signup" && (
              <>
                <span>Já possui uma conta?</span>
                <button
                  type="button"
                  onClick={() => changeMode("login")}
                >
                  Entrar
                </button>
              </>
            )}

            {mode === "recovery" && (
              <>
                <span>Lembrou sua senha?</span>
                <button
                  type="button"
                  onClick={() => changeMode("login")}
                >
                  Voltar para o login
                </button>
              </>
            )}
          </div>

          <div className="security">
            <span className="security-dot" />
            Seus dados financeiros ficam separados na sua conta.
          </div>
        </div>

        <p className="footer">
          Meu Financeiro • controle pessoal
        </p>
      </section>

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap");

        * {
          box-sizing: border-box;
        }

        .login-page {
          --cyan: #19d3ce;
          --cyan-dark: #0ea8a4;

          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          padding: 40px 20px;
          font-family: "DM Sans", system-ui, sans-serif;
          transition: 0.25s ease;
        }

        .dark {
          --bg: #080d19;
          --surface: #111a2b;
          --surface-2: #162238;
          --border: #263653;
          --text: #f2f5fb;
          --muted: #91a1c1;
          --input: #0d1627;

          background:
            radial-gradient(
              circle at 50% 0%,
              rgba(25, 211, 206, 0.08),
              transparent 34%
            ),
            #080d19;

          color: var(--text);
        }

        .light {
          --bg: #edf2f8;
          --surface: #ffffff;
          --surface-2: #f6f8fc;
          --border: #d8e0ed;
          --text: #182338;
          --muted: #61708e;
          --input: #ffffff;

          background:
            radial-gradient(
              circle at 50% 0%,
              rgba(25, 211, 206, 0.13),
              transparent 34%
            ),
            #edf2f8;

          color: var(--text);
        }

        .grid-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.16;
          background-image:
            linear-gradient(
              rgba(120, 150, 190, 0.08) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(120, 150, 190, 0.08) 1px,
              transparent 1px
            );
          background-size: 48px 48px;
        }

        .glow {
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          filter: blur(2px);
        }

        .glow-one {
          width: 420px;
          height: 420px;
          top: -250px;
          left: -160px;
          background: rgba(25, 211, 206, 0.08);
        }

        .glow-two {
          width: 480px;
          height: 480px;
          right: -250px;
          bottom: -280px;
          background: rgba(30, 105, 220, 0.09);
        }

        .theme-switch {
          position: fixed;
          top: 22px;
          right: 24px;
          display: flex;
          gap: 4px;
          padding: 4px;
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 12px;
          z-index: 10;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        }

        .theme-switch button {
          width: 34px;
          height: 32px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--muted);
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .theme-switch button.active {
          background: var(--cyan);
          color: #062021;
        }

        .login-container {
          width: 100%;
          max-width: 450px;
          position: relative;
          z-index: 2;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 13px;
          margin: 0 auto 22px;
          padding-left: 4px;
        }

        .brand-logo {
          width: 47px;
          height: 47px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          color: #071d20;
          background: linear-gradient(
            135deg,
            #1de1dc,
            #13bdb8
          );
          box-shadow:
            0 10px 28px rgba(25, 211, 206, 0.18);
        }

        .brand h1 {
          margin: 0;
          font-family: "Fraunces", Georgia, serif;
          font-size: 23px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: -0.3px;
        }

        .brand p {
          margin: 5px 0 0;
          color: var(--muted);
          font-size: 12px;
        }

        .login-card {
          width: 100%;
          padding: 32px;
          border: 1px solid var(--border);
          border-radius: 20px;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.025),
              rgba(255, 255, 255, 0)
            ),
            var(--surface);
          box-shadow:
            0 30px 80px rgba(0, 0, 0, 0.24);
        }

        .heading {
          margin-bottom: 26px;
        }

        .heading h2 {
          margin: 0 0 8px;
          font-family: "Fraunces", Georgia, serif;
          font-size: 29px;
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .heading p {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        label {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        label span {
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }

        input {
          width: 100%;
          height: 49px;
          border: 1px solid var(--border);
          border-radius: 11px;
          padding: 0 14px;
          background: var(--input);
          color: var(--text);
          outline: none;
          font: 500 13px "DM Sans", sans-serif;
          transition: 0.18s ease;
        }

        input::placeholder {
          color: #6e7d9c;
        }

        input:focus {
          border-color: var(--cyan);
          box-shadow:
            0 0 0 3px rgba(25, 211, 206, 0.09);
        }

        .password-wrap {
          position: relative;
        }

        .password-wrap input {
          padding-right: 48px;
        }

        .password-wrap button {
          position: absolute;
          right: 0;
          top: 0;
          width: 46px;
          height: 49px;
          border: 0;
          background: transparent;
          color: var(--muted);
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .password-wrap button:hover {
          color: var(--cyan);
        }

        .forgot {
          display: flex;
          justify-content: flex-end;
          margin-top: -5px;
        }

        .forgot button,
        .switch button {
          border: 0;
          padding: 0;
          background: transparent;
          color: var(--cyan);
          font: 700 12px "DM Sans", sans-serif;
          cursor: pointer;
        }

        .submit {
          width: 100%;
          height: 49px;
          margin-top: 3px;
          border: 0;
          border-radius: 11px;
          background: linear-gradient(
            135deg,
            #20dcd7,
            #0fb5b1
          );
          color: #062021;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          font: 700 14px "DM Sans", sans-serif;
          cursor: pointer;
          box-shadow:
            0 10px 28px rgba(25, 211, 206, 0.14);
          transition: 0.18s ease;
        }

        .submit:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }

        .submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .switch {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
          margin-top: 21px;
          color: var(--muted);
          font-size: 12px;
        }

        .security {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 7px;
          margin-top: 23px;
          padding-top: 17px;
          border-top: 1px solid var(--border);
          color: var(--muted);
          text-align: center;
          font-size: 10.5px;
        }

        .security-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--cyan);
          box-shadow: 0 0 10px rgba(25, 211, 206, 0.5);
        }

        .alert {
          padding: 11px 13px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 12px;
          line-height: 1.4;
        }

        .error {
          color: #ff9a91;
          background: rgba(220, 91, 75, 0.08);
          border: 1px solid rgba(220, 91, 75, 0.2);
        }

        .success {
          color: var(--cyan);
          background: rgba(25, 211, 206, 0.07);
          border: 1px solid rgba(25, 211, 206, 0.17);
        }

        .footer {
          margin: 18px 0 0;
          text-align: center;
          color: var(--muted);
          opacity: 0.7;
          font-size: 10px;
        }

        @media (max-width: 600px) {
          .login-page {
            padding: 70px 15px 30px;
          }

          .theme-switch {
            top: 14px;
            right: 14px;
          }

          .login-container {
            max-width: 100%;
          }

          .brand {
            margin-bottom: 18px;
          }

          .brand-logo {
            width: 44px;
            height: 44px;
          }

          .brand h1 {
            font-size: 21px;
          }

          .login-card {
            padding: 25px 20px;
            border-radius: 17px;
          }

          .heading h2 {
            font-size: 26px;
          }

          input,
          .submit {
            height: 50px;
          }

          .footer {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}