"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/utils/client";

export default function LoginPage() {
  const [modo, setModo] = useState<"login" | "cadastro">("login");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");

  const [loading, setLoading] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  const [mensagem, setMensagem] = useState("");
  const [mostrarReenviar, setMostrarReenviar] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMensagem("");
    setMostrarReenviar(false);

    try {
      if (modo === "cadastro") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,

          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,

            data: {
              nome: nome.trim(),
            },
          },
        });

        if (error) {
          setMensagem(error.message);
          return;
        }

        /*
         * O Supabase pode não retornar erro quando o e-mail
         * já existe, por questões de segurança.
         *
         * Por isso mostramos a orientação para verificar
         * o e-mail e, se necessário, reenviar a confirmação.
         */

        if (data.user) {
          setMensagem(
            "Conta criada! Enviamos um e-mail para você. Confirme seu endereço para finalizar o cadastro."
          );

          setMostrarReenviar(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        });

        if (error) {
          setMensagem("E-mail ou senha incorretos.");
          return;
        }

        window.location.href = "/";
      }
    } catch (error) {
      console.error(error);

      setMensagem(
        "Ocorreu um erro. Verifique sua conexão e tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  async function reenviarConfirmacao() {
    if (!email.trim()) {
      setMensagem("Digite seu e-mail primeiro.");
      return;
    }

    setReenviando(true);
    setMensagem("");

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: "http://192.168.1.12:3000/login",
        },
      });

      if (error) {
        if (
          error.message.toLowerCase().includes("already confirmed") ||
          error.message.toLowerCase().includes("already been confirmed")
        ) {
          setMensagem(
            "Esse e-mail já foi confirmado. Agora é só entrar com seu e-mail e senha."
          );

          setMostrarReenviar(false);
        } else {
          setMensagem(error.message);
        }

        return;
      }

      setMensagem(
        "Novo e-mail de confirmação enviado! Verifique sua caixa de entrada."
      );
    } catch (error) {
      console.error(error);

      setMensagem(
        "Não foi possível reenviar agora. Tente novamente em alguns segundos."
      );
    } finally {
      setReenviando(false);
    }
  }

  function trocarModo() {
    setModo(modo === "login" ? "cadastro" : "login");
    setMensagem("");
    setMostrarReenviar(false);
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

          <div style={{ marginBottom: "20px" }}>
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

          {/* BOTÃO PRINCIPAL */}

          <button
            type="submit"
            disabled={loading || reenviando}
            style={{
              width: "100%",
              border: 0,
              borderRadius: "12px",
              padding: "14px",
              background: "#20e58a",
              color: "#06131d",
              fontSize: "16px",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? "Aguarde..."
              : modo === "login"
                ? "Entrar"
                : "Criar minha conta"}
          </button>
        </form>

        {/* REENVIAR CONFIRMAÇÃO */}

        {modo === "cadastro" && mostrarReenviar && (
          <button
            type="button"
            onClick={reenviarConfirmacao}
            disabled={reenviando}
            style={{
              width: "100%",
              marginTop: "12px",
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid rgba(32,229,138,.35)",
              background: "transparent",
              color: "#20e58a",
              fontSize: "14px",
              fontWeight: 700,
              cursor: reenviando ? "not-allowed" : "pointer",
              opacity: reenviando ? 0.7 : 1,
            }}
          >
            {reenviando
              ? "Enviando..."
              : "Reenviar e-mail de confirmação"}
          </button>
        )}

        {/* TROCAR ENTRE LOGIN E CADASTRO */}

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