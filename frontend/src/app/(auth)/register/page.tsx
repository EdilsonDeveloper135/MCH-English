"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";

export default function RegisterPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasHydrated && token) router.replace("/library");
  }, [hasHydrated, token, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { access_token } = await api.register(email, password);
      setAuth(access_token, email);
      router.push("/library");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-white mb-6">Crear cuenta</h1>
        <label htmlFor="register-email" className="sr-only">
          Email
        </label>
        <input
          id="register-email"
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-600"
        />
        <label htmlFor="register-password" className="sr-only">
          Contrasena (minimo 8 caracteres)
        </label>
        <input
          id="register-password"
          type="password"
          required
          minLength={8}
          placeholder="Contrasena (minimo 8 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-600"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Creando..." : "Crear cuenta"}
        </button>
        <p className="text-sm text-gray-400">
          Ya tenes cuenta?{" "}
          <Link href="/login" className="text-white underline">
            Iniciar sesion
          </Link>
        </p>
      </form>
    </div>
  );
}
