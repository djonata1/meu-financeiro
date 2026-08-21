"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/utils/client";

export default function ResetPasswordPage() {
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [loading, setLoading] = useState(false);
  const [verificando, setVerificando] = useState(true);

  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function verificarSessao() {
      try {
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          setErro(
            "Este link de recuperação é inválido ou expirou. Solicite um novo link."
          );
        }
      } catch (error) {
        console.error(error);

        setErro(
          "Não foi possível verificar o link de recuperação."
        );
      } finally {
        setVerificando(false);
      }
    }

    verificarSessao();
  }, []);

  async function alterarSenha(e: FormEvent) {
    e.preventDefault();

    setMensagem("");
    setErro("");

    if (senha.length < 6) {
      setErro("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      setErro("As senhas não são iguais.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: senha,
      });

      if (error) {
        console.error(error);

        setErro(
          "Não foi possível alterar sua senha. Solicite um novo link e tente novamente."
        );

        return;
      }

      setMensagem(
        "Senha alterada com sucesso! Você será redirecionado para o login."
      );

      setSenha("");
      setConfirmarSenha("");

      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch (error) {
      console.error(error);

      setErro(
        "Ocorreu um erro. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  if (verificando) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={iconStyle}>$</div>

          <h1 style={titleStyle}>Meu Financeiro</h1>

          <p style={descriptionStyle}>
            Verificando seu link de recuperação...
          </p>
        </div>
      </main>
    );
  }

  if (erro && !mensagem) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div
            style={{
              ...iconStyle,
              background: "rgba(255,85,102,.12)",
              color: "#ff5566",
            }}
          >
            !
          </div>

          <h1 style={titleStyle}>Link inválido</h1>

          <p style={descriptionStyle}>{erro}</p>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/login";
            }}
            style={buttonStyle}
          >
            Voltar para o login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={iconStyle}>$</div>

        <h1 style={titleStyle}>Criar nova senha</h1>

        <p style={descriptionStyle}>
          Digite uma nova senha para proteger sua conta.
        </p>

        {mensagem && (
          <div
            style={{
              padding: "13px 14px",
              borderRadius: "12px",
              background: "rgba(32,229,138,.08)",
              border: "1px solid rgba(32,229,138,.15)",
              color: "#20e58a",
              marginBottom: "16px",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            {mensagem}
          </div>
        )}

        {erro && (
          <div
            style={{
              padding: "13px 14px",
              borderRadius: "12px",
              background: "rgba(255,85,102,.08)",
              border: "1px solid rgba(255,85,102,.15)",
              color: "#ff7a88",
              marginBottom: "16px",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            {erro}
          </div>
        )}

        {!mensagem && (
          <form onSubmit={alterarSenha}>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>
                Nova senha
              </label>

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

            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>
                Confirmar nova senha
              </label>

              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) =>
                  setConfirmarSenha(e.target.value)
                }
                placeholder="••••••••"
                minLength={6}
                required
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...buttonStyle,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading
                ? "Alterando senha..."
                : "Alterar minha senha"}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => {
            window.location.href = "/login";
          }}
          style={{
            width: "100%",
            marginTop: "14px",
            padding: "12px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,.1)",
            background: "transparent",
            color: "#8fa1b5",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Voltar para o login
        </button>
      </div>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#07111f",
  padding: "24px",
  color: "white",
};

const cardStyle = {
  width: "100%",
  maxWidth: "430px",
  background: "#0d1b2a",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: "24px",
  padding: "36px",
  boxShadow: "0 25px 80px rgba(0,0,0,.35)",
};

const iconStyle = {
  width: "58px",
  height: "58px",
  borderRadius: "16px",
  background: "#20e58a",
  color: "#06131d",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 18px",
  fontSize: "28px",
  fontWeight: 900,
};

const titleStyle = {
  margin: 0,
  textAlign: "center" as const,
  fontSize: "26px",
  fontWeight: 800,
};

const descriptionStyle = {
  color: "#8fa1b5",
  marginTop: "10px",
  marginBottom: "24px",
  textAlign: "center" as const,
  lineHeight: 1.5,
};

const labelStyle = {
  display: "block",
  fontSize: "14px",
  fontWeight: 700,
  marginBottom: "7px",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px 14px",
  borderRadius: "11px",
  border: "1px solid rgba(255,255,255,.1)",
  background: "#081522",
  color: "white",
  outline: "none",
  fontSize: "15px",
};

const buttonStyle = {
  width: "100%",
  border: 0,
  borderRadius: "12px",
  padding: "14px",
  background: "#20e58a",
  color: "#06131d",
  fontSize: "16px",
  fontWeight: 800,
  cursor: "pointer",
};