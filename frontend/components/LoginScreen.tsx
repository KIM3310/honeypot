// frontend/components/LoginScreen.tsx

import React, { useState } from "react";
import { LogIn, Sparkles, ShieldCheck, ArrowRight } from "lucide-react";
import { loginUser } from "../services/authService.ts";
import { setToken, setUserInfo } from "../utils/auth.ts";
import { HandoverSchema, HealthSummary, ServiceBrief, ServiceMeta } from "../types.ts";
import ServiceReadinessBoard from "./ServiceReadinessBoard.tsx";

interface Props {
  apiMisconfigured: boolean;
  backendReachable: boolean;
  handoverSchema: HandoverSchema | null;
  healthSummary: HealthSummary | null;
  onLogin: (userInfo: any) => void;
  runtimeStatusMessage: string;
  serviceBrief: ServiceBrief | null;
  serviceMeta: ServiceMeta | null;
}

const LoginScreen: React.FC<Props> = ({
  apiMisconfigured,
  backendReachable,
  handoverSchema,
  healthSummary,
  onLogin,
  runtimeStatusMessage,
  serviceBrief,
  serviceMeta,
}) => {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const loginDisabled = isLoading || apiMisconfigured || !backendReachable;
  const connectionTone = apiMisconfigured
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : backendReachable
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : "border-slate-300 bg-slate-100 text-slate-700";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginDisabled) {
      return;
    }
    setError("");
    setIsLoading(true);

    try {
      // authService에서 이미 setToken과 setUserInfo가 호출됨!
      const response = await loginUser(id, pw);

      // ✅ authService에서 이미 저장했으므로 여기서는 그냥 onLogin 호출
      console.log("✅ 로그인 성공:", response.user_name);

      // ✅ userInfo 객체를 만들어서 전달
      const userInfo = {
        email: response.user_email,
        name: response.user_name,
        role: response.user_role,
      };

      onLogin(userInfo);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "로그인 실패";
      setError(errorMessage);
      console.error("❌ 로그인 실패:", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF0] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="honeycomb-bg"></div>
      
      {/* Floating Elements for Decoration */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>

      <div className="w-full max-w-md bg-white/80 backdrop-blur-2xl p-10 rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(252,211,77,0.2)] border border-white relative z-10 animate-in zoom-in-95 duration-700">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-40 h-40 mb-4 group hover:scale-110 transition-all duration-500 cursor-pointer">
             <img 
               src="https://i.ibb.co/PvGzg7cK/Gemini-Generated-Image-ip7k7xip7k7xip7k.png" 
               alt="꿀단지 로고" 
               className="w-full h-full object-contain drop-shadow-2xl transition-transform rounded-full"
               onError={(e) => {
                 e.currentTarget.src = "https://api.iconify.design/noto:honey-pot.svg";
               }}
             />
          </div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tighter">꿀단지 접속하기</h1>
          <p className="text-sm font-bold text-yellow-600 mt-2">당신의 업무를 가장 달콤하게 이어주는 AI</p>
        </div>

        <div className="mb-6">
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-left text-xs font-bold leading-relaxed ${connectionTone}`}
            role="status"
          >
            {runtimeStatusMessage}
          </div>
          <ServiceReadinessBoard
            handoverSchema={handoverSchema}
            healthSummary={healthSummary}
            serviceBrief={serviceBrief}
            serviceMeta={serviceMeta}
            variant="compact"
          />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-2xl text-sm font-bold">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">사번 또는 ID</label>
            <input 
              type="text" 
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="operator-id"
              disabled={loginDisabled}
              className="w-full px-6 py-4 bg-yellow-50/50 border border-yellow-100 rounded-2xl focus:ring-4 focus:ring-yellow-400/10 focus:border-yellow-300 outline-none transition-all font-bold placeholder:text-yellow-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">비밀번호</label>
            <input 
              type="password" 
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              disabled={loginDisabled}
              className="w-full px-6 py-4 bg-yellow-50/50 border border-yellow-100 rounded-2xl focus:ring-4 focus:ring-yellow-400/10 focus:border-yellow-300 outline-none transition-all font-bold placeholder:text-yellow-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <button 
            type="submit"
            disabled={loginDisabled}
            className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-2xl hover:bg-black hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading
              ? "로그인 중..."
              : apiMisconfigured
                ? "백엔드 설정 필요"
                : backendReachable
                  ? "로그인"
                  : "백엔드 연결 필요"}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-yellow-50 flex flex-col gap-4">
          <div className="flex items-center gap-3 text-[11px] font-bold text-gray-400">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            보안된 사내 망을 통해 안전하게 접속 중입니다.
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold text-gray-400">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            Microsoft Azure 클라우드 환경에서 안전하게 보호됩니다.
          </div>
        </div>

        <div className="mt-8 p-4 bg-yellow-50/70 rounded-2xl border border-yellow-200 text-center">
          <p className="text-xs font-black text-yellow-700 uppercase tracking-wider">개발용 로그인</p>
          <p className="mt-2 text-[11px] text-yellow-700 font-bold">
            로컬 demo 계정은 backend 설정과 환경 변수에서 관리합니다.
          </p>
        </div>
      </div>

      <div className="absolute bottom-8 text-[10px] font-black text-yellow-600/30 uppercase tracking-[1em]">
        Kkuldanji AI Handover System
      </div>
    </div>
  );
};

export default LoginScreen;
