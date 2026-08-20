"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/client";

export default function AuthCallbackPage() {
  const [mensagem, setMensagem] = useState("Confirmando sua conta...");

  useEffect(() => {
    async function confirmar() {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        console.error(error);
        setMensagem("Não foi possível confirmar sua conta.");
        return;
      }

      setMensagem("Conta confirmada! Entrando...");

      setTimeout(() => {
        window.location.href = "/";
      }, 800);
    }

    confirmar();
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

        <h1 style={{ margin: 0 }}>Meu Financeiro</h1>

        <p
          style={{
            color: "#8fa1b5",
            marginTop: "12px",
          }}
        >
          {mensagem}
        </p>
      </div>
    </main>
  );
}