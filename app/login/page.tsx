"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/utils/client";

export default function LoginPage() {
  const [modo, setModo] = useState<"login" | "cadastro">("login");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");

  const [loading, setLoading] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  const [mensagem, setMensagem] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMensagem("");

    try {
      // =========================
      // CADASTRO
      // =========================
      if (modo === "cadastro") {
        if (!nome.trim()) {
          setMensagem("Digite seu nome.");
          setLoading(false);
          return;
        }

        if (!email.trim()) {
          setMensagem("Digite seu e-mail.");
          setLoading(false);
          return;
        }

        if (senha.length < 6) {
          setMensagem("A senha precisa ter pelo menos 6 caracteres.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: {
            data: {
              nome: nome.trim(),
              name: nome.trim(),
            },
          },
        });

        if (error) {
          console.error("Erro no cadastro:", error);

          setMensagem(error.message);
          setLoading(false);
          return;
        }

        console.log("Resultado do cadastro:", data);

        // ==========================================
        // CONTA CRIADA
        // ==========================================

        // Mantém o e-mail para facilitar o login.
        const emailCadastrado = email.trim();

        // Limpa a senha por segurança.
        setSenha("");

        // Volta para a tela de login.
        setModo("login");

        // Mostra a confirmação.
        setMensagem(
          "Conta criada com sucesso! Agora entre com seu e-mail e senha."
        );

        setEmail(emailCadastrado);

        setLoading(false);
        return;
      }

      // =========================
      // LOGIN
      // =========================

      const emailLimpo = email.trim();

      if (!emailLimpo) {
        setMensagem("Digite seu e-mail.");
        setLoading(false);
        return;
      }

      if (!senha) {
        setMensagem("Digite sua senha.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailLimpo,
        password: senha,
      });

      if (error) {
        console.error("Erro no login:", error);

        const msg = error.message.toLowerCase();

        if (
          msg.includes("invalid login credentials") ||
          msg.includes("invalid credentials")
        ) {
          setMensagem(
            "E-mail ou senha incorretos. Confira os dados e tente novamente."
          );
        } else if (msg.includes("email not confirmed")) {
          setMensagem(
            "Este e-mail ainda não foi confirmado no Supabase."
          );
        } else {
          setMensagem(error.message);
        }

        setLoading(false);
        return;
      }

      console.log("Login realizado:", data);

      if (data.session) {
        window.location.href = "/";
        return;
      }

      setMensagem("Não foi possível iniciar sua sessão.");
      setLoading(false);
    } catch (error) {
      console.error("Erro inesperado:", error);

      setMensagem(
        "Ocorreu um erro. Verifique sua conexão e tente novamente."
      );

      setLoading(false);
    }
  }

  // =========================
  // RECUPERAÇÃO DE SENHA
  // =========================

  async function recuperarSenha() {
    const emailLimpo = email.trim();

    if (!emailLimpo) {
      setMensagem("Digite seu e-mail primeiro.");
      return;
    }

    setRecuperando(true);
    setMensagem("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        emailLimpo,
        {
          redirectTo: `${window.location.origin}/login/reset-password`,
        }
      );

      if (error) {
        console.error("Erro ao recuperar senha:", error);

        const msg = error.message.toLowerCase();

        if (
          msg.includes("rate limit") ||
          msg.includes("too many")
        ) {
          setMensagem(
            "O limite de envio de e-mails foi atingido. Aguarde um pouco e tente novamente."
          );
        } else {
          setMensagem(
            "Não foi possível enviar o e-mail de recuperação. Tente novamente."
          );
        }

        setRecuperando(false);
        return;
      }

      setMensagem(
        "Enviamos um link para redefinir sua senha. Verifique seu e-mail e clique no link."
      );
    } catch (error) {
      console.error(error);

      setMensagem(
        "Ocorreu um erro ao enviar o e-mail. Tente novamente."
      );
    } finally {
      setRecuperando(false);
    }
  }

  // =========================
  // TROCAR LOGIN / CADASTRO
  // =========================

  function trocarModo() {
    setModo(modo === "login" ? "cadastro" : "login");
    setMensagem("");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#07111f",
        padding: "24px",
        color: "white",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "#0d1b2a",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: "24px",
          padding: "36px",
          boxShadow: "0 25px 80px rgba(0,0,0,.35)",
        }}
      >
        {/* CABEÇALHO */}

        <div
          style={{
            textAlign: "center",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              width: "58px",
              height: "58px",
              borderRadius: "16px",
              background: "#20e58a",
              color: "#06131d",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: "28px",
              fontWeight: 900,
            }}
          >
            $
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 800,
            }}
          >
            Meu Financeiro
          </h1>

          <p
            style={{
              color: "#8fa1b5",
              marginTop: "8px",
            }}
          >
            {modo === "login"
              ? "Entre para acessar suas finanças"
              : "Crie sua conta gratuitamente"}
          </p>
        </div>

        {/* FORMULÁRIO */}

        <form onSubmit={handleSubmit}>
          {/* NOME */}

          {modo === "cadastro" && (
            <div style={{ marginBottom: "16px" }}>
              <label>Nome</label>

              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                required
                style={inputStyle}
              />
            </div>
          )}

          {/* E-MAIL */}

          <div style={{ marginBottom: "16px" }}>
            <label>E-mail</label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              style={inputStyle}
            />
          </div>

          {/* SENHA */}

          <div style={{ marginBottom: "8px" }}>
            <label>Senha</label>

            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
              style={inputStyle}
            />
          </div>

          {/* ESQUECI A SENHA */}

          {modo === "login" && (
            <div
              style={{
                textAlign: "right",
                marginBottom: "18px",
              }}
            >
              <button
                type="button"
                onClick={recuperarSenha}
                disabled={recuperando}
                style={{
                  background: "none",
                  border: 0,
                  color: "#20e58a",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: recuperando
                    ? "not-allowed"
                    : "pointer",
                  padding: 0,
                  opacity: recuperando ? 0.7 : 1,
                }}
              >
                {recuperando
                  ? "Enviando..."
                  : "Esqueci minha senha"}
              </button>
            </div>
          )}

          {/* MENSAGEM */}

          {mensagem && (
            <div
              style={{
                padding: "13px 14px",
                borderRadius: "12px",
                background: "rgba(32,229,138,.08)",
                border: "1px solid rgba(32,229,138,.12)",
                color: "#20e58a",
                marginBottom: "14px",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              {mensagem}
            </div>
          )}

          {/* BOTÃO */}

          <button
            type="submit"
            disabled={loading || recuperando}
            style={{
              width: "100%",
              border: 0,
              borderRadius: "12px",
              padding: "14px",
              background: "#20e58a",
              color: "#06131d",
              fontSize: "16px",
              fontWeight: 800,
              cursor:
                loading || recuperando
                  ? "not-allowed"
                  : "pointer",
              opacity:
                loading || recuperando ? 0.7 : 1,
            }}
          >
            {loading
              ? "Aguarde..."
              : modo === "login"
                ? "Entrar"
                : "Criar minha conta"}
          </button>
        </form>

        {/* TROCAR MODO */}

        <div
          style={{
            textAlign: "center",
            marginTop: "24px",
            color: "#8fa1b5",
            fontSize: "14px",
          }}
        >
          {modo === "login"
            ? "Ainda não tem uma conta?"
            : "Já tem uma conta?"}

          <button
            type="button"
            onClick={trocarModo}
            style={{
              background: "none",
              border: 0,
              color: "#20e58a",
              fontWeight: 700,
              cursor: "pointer",
              marginLeft: "6px",
            }}
          >
            {modo === "login" ? "Criar conta" : "Entrar"}
          </button>
        </div>
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  marginTop: "7px",
  padding: "13px 14px",
  borderRadius: "11px",
  border: "1px solid rgba(255,255,255,.1)",
  background: "#081522",
  color: "white",
  outline: "none",
  fontSize: "15px",
};