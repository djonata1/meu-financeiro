"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/client";

export default function AuthCallbackPage() {
  const [mensagem, setMensagem] = useState("Processando...");

  useEffect(() => {
    async function processar() {
      try {
        const url = new URL(window.location.href);

        const tipo = url.searchParams.get("type");
        const next = url.searchParams.get("next");

        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        if (error) {
          console.error("Erro no callback:", error);
          setMensagem("Não foi possível processar o link.");
          return;
        }

        /*
         * RECUPERAÇÃO DE SENHA
         *
         * Se o link veio do "Esqueci minha senha",
         * NÃO vamos entrar direto no sistema.
         *
         * Vamos mandar o usuário para a tela
         * onde ele poderá criar uma nova senha.
         */
        if (tipo === "recovery") {
          setMensagem("Link confirmado! Abrindo recuperação de senha...");

          setTimeout(() => {
            window.location.href = "/login/reset-password";
          }, 500);

          return;
        }

        /*
         * Se houver um destino específico,
         * usamos ele.
         */
        if (next) {
          setMensagem("Tudo certo! Abrindo...");

          setTimeout(() => {
            window.location.href = next;
          }, 500);

          return;
        }

        /*
         * Cadastro normal
         */
        setMensagem("Conta confirmada! Entrando...");

        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      } catch (error) {
        console.error(error);
        setMensagem("Ocorreu um erro ao processar o link.");
      }
    }

    processar();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#07111f",
        color: "white",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          textAlign: "center",
          background: "#0d1b2a",
          borderRadius: "24px",
          padding: "40px 30px",
          border: "1px solid rgba(255,255,255,.08)",
          boxShadow: "0 25px 80px rgba(0,0,0,.35)",
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
            margin: "0 auto 20px",
            fontSize: "28px",
            fontWeight: 900,
          }}
        >
          ✓
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
            marginTop: "12px",
            lineHeight: 1.5,
          }}
        >
          {mensagem}
        </p>
      </div>
    </main>
  );
}