import React, { useState, useEffect } from "react";
import { HandoverData } from "../types.ts";
import {
  FileText,
  Users,
  Briefcase,
  ListTodo,
  Layers,
  Key,
  CheckSquare,
  Sparkles,
  AlertTriangle,
  Clock,
  ChevronRight,
  Plus,
  Trash2,
  Printer,
  Save,
  Download,
} from "lucide-react";

interface Props {
  data: HandoverData | null;
  onUpdate: (data: HandoverData) => void;
}

const InputField = ({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = "",
}: any) => {
  const [localValue, setLocalValue] = useState(value || "");

  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
  };

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  return (
    <div className="mb-4 group">
      <label className="block text-[9px] font-black text-yellow-600 uppercase mb-1.5 tracking-widest">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full p-3.5 bg-white border border-yellow-100 rounded-xl focus:ring-4 focus:ring-yellow-400/10 focus:border-yellow-300 outline-none transition-all text-xs font-medium min-h-[100px] shadow-sm resize-none"
        />
      ) : (
        <input
          type="text"
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full p-3.5 bg-white border border-yellow-100 rounded-xl focus:ring-4 focus:ring-yellow-400/10 focus:border-yellow-300 outline-none transition-all text-xs font-bold shadow-sm"
        />
      )}
    </div>
  );
};

const Section = ({ title, icon, color = "yellow", children, onAdd }: any) => {
  const colors: Record<string, string> = {
    yellow: "bg-amber-50 border-amber-100 text-amber-800",
    orange: "bg-orange-50 border-orange-100 text-orange-800",
    blue: "bg-blue-50 border-blue-100 text-blue-800",
    red: "bg-red-50 border-red-100 text-red-800",
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-800",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-800",
    teal: "bg-teal-50 border-teal-100 text-teal-800",
  };

  return (
    <div className={`p-6 rounded-[2rem] border shadow-sm relative overflow-hidden group/section ${colors[color] || colors.yellow}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[10px] font-black mb-0 flex items-center gap-2 uppercase tracking-widest">
          {icon || <ChevronRight className="w-3 h-3" />} {title}
        </h3>
        {onAdd && (
          <button
            onClick={onAdd}
            className="p-1.5 bg-white rounded-lg text-gray-400 hover:text-yellow-600 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
};

const ListEditor = ({ items, onUpdate, onRemove, renderItem, emptyText }: any) => {
  if (!items || items.length === 0) {
    return <p className="text-[10px] text-gray-400 italic text-center py-4">{emptyText || "항목이 없습니다."}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item: any, idx: number) => (
        <div key={idx} className="relative group/row">
          {renderItem(item, idx)}
          <button
            onClick={() => onRemove(idx)}
            className="absolute top-2 right-2 opacity-0 group-hover/row:opacity-100 p-1.5 text-red-200 hover:text-red-500 transition-all z-10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

const HandoverForm: React.FC<Props> = ({ data, onUpdate }) => {
  const [activeTab, setActiveTab] = useState(0);

  if (!data) {
    return (
      <div className="flex-1 bg-white/60 backdrop-blur-xl rounded-[2.5rem] border-2 border-dashed border-yellow-200 flex flex-col items-center justify-center p-12 text-center h-full animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-yellow-100 rounded-3xl flex items-center justify-center mb-6 shadow-inner animate-bounce">
          <Sparkles className="w-12 h-12 text-yellow-500" />
        </div>
        <h3 className="text-xl font-black text-gray-800">
          새로운 꿀단지가 비어있어요
        </h3>
        <p className="text-gray-400 mt-2 text-xs font-bold leading-relaxed">
          오른쪽 보관함에 자료를 넣고 '리포트 생성'을 눌러주세요.
          <br />
          AI가 분석한 인수인계서가 이곳에 나타납니다.
        </p>
      </div>
    );
  }

  const handleChange = (path: string, value: any) => {
    const newData = JSON.parse(JSON.stringify(data));
    const keys = path.split(".");
    let current: any = newData;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    onUpdate(newData);
  };

  const addItem = (path: string, defaultItem: any) => {
    const newData = JSON.parse(JSON.stringify(data));
    const keys = path.split(".");
    let current: any = newData;
    for (const key of keys) current = current[key];
    current.push(defaultItem);
    onUpdate(newData);
  };

  const removeItem = (path: string, index: number) => {
    const newData = JSON.parse(JSON.stringify(data));
    const keys = path.split(".");
    let current: any = newData;
    for (const key of keys) current = current[key];
    current.splice(index, 1);
    onUpdate(newData);
  };

  const tabs = [
    { name: "1. 개요", icon: <FileText className="w-4 h-4" /> },
    { name: "2. 직무", icon: <Briefcase className="w-4 h-4" /> },
    { name: "3. 과제", icon: <ListTodo className="w-4 h-4" /> },
    { name: "4. 현황", icon: <Layers className="w-4 h-4" /> },
    { name: "5. 자료", icon: <Key className="w-4 h-4" /> },
    { name: "6. 확인", icon: <CheckSquare className="w-4 h-4" /> },
  ];



  const handleExportJSON = async () => {
    if ((window as any).electronAPI) {
      try {
        const result = await (window as any).electronAPI.saveJson(
          data,
          `handover_${new Date().toISOString().split("T")[0]}.json`
        );
        if (result.success) {
          alert(`저장되었습니다: ${result.filePath}`);
        }
      } catch (error) {
        console.error("저장 실패:", error);
        alert("저장에 실패했습니다.");
      }
    } else {
      // 웹 환경 폴백 (다운로드 링크 생성)
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `handover_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExportPDF = async () => {
    if ((window as any).electronAPI) {
      try {
        const result = await (window as any).electronAPI.savePdf(
          `handover_${new Date().toISOString().split("T")[0]}.pdf`
        );
        if (result.success) {
          alert(`저장되었습니다: ${result.filePath}`);
        }
      } catch (error) {
        console.error("PDF 저장 실패:", error);
        alert("PDF 저장에 실패했습니다.");
      }
    } else {
      window.print();
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-yellow-100 h-full flex flex-col overflow-hidden relative">
      <div className="flex justify-between items-center p-4 border-b border-yellow-100 bg-white">
        <h2 className="text-sm font-black text-yellow-600 uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> 인수인계서 리포트
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-600 rounded-lg text-xs font-bold hover:bg-yellow-100 transition-colors"
          >
            <Save className="w-3.5 h-3.5" /> JSON 저장
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs font-bold hover:bg-yellow-600 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> PDF 저장
          </button>
        </div>
      </div>
      {/* Tab Navigation */}
      <div className="flex bg-yellow-50/50 border-b border-yellow-100 p-2 gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-black transition-all rounded-xl whitespace-nowrap ${
              activeTab === idx
                ? "bg-white text-yellow-600 shadow-md ring-1 ring-yellow-100"
                : "text-gray-400 hover:text-gray-600 hover:bg-white/50"
            }`}
          >
            {tab.icon} {tab.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-gradient-to-b from-white to-yellow-50/10">
        {/* Tab 1: 개요 */}
        {activeTab === 0 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-6">
              <Section title="인계자 정보" color="yellow">
                <InputField
                  label="이름"
                  value={data.overview.transferor.name}
                  onChange={(v: any) => handleChange("overview.transferor.name", v)}
                />
                <InputField
                  label="직급/부서"
                  value={data.overview.transferor.position}
                  onChange={(v: any) => handleChange("overview.transferor.position", v)}
                />
                <InputField
                  label="연락처"
                  value={data.overview.transferor.contact}
                  onChange={(v: any) => handleChange("overview.transferor.contact", v)}
                />
              </Section>
              <Section title="인수자 정보" color="orange">
                <InputField
                  label="이름"
                  value={data.overview.transferee.name}
                  onChange={(v: any) => handleChange("overview.transferee.name", v)}
                />
                <InputField
                  label="직급/부서"
                  value={data.overview.transferee.position}
                  onChange={(v: any) => handleChange("overview.transferee.position", v)}
                />
                <InputField
                  label="부임 예정일"
                  value={data.overview.transferee.startDate}
                  onChange={(v: any) => handleChange("overview.transferee.startDate", v)}
                />
              </Section>
            </div>

            <div className="space-y-4">
              <InputField
                label="인계 사유"
                value={data.overview.reason}
                multiline
                onChange={(v: any) => handleChange("overview.reason", v)}
              />
              <InputField
                label="배경 및 배경 정보"
                value={data.overview.background}
                multiline
                onChange={(v: any) => handleChange("overview.background", v)}
              />
              <InputField
                label="인계 기간"
                value={data.overview.period}
                onChange={(v: any) => handleChange("overview.period", v)}
                placeholder="YYYY.MM.DD ~ YYYY.MM.DD"
              />
            </div>
          </div>
        )}

        {/* Tab 2: 직무 */}
        {activeTab === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Section title="공식 직무 개요" color="blue">
              <InputField
                label="공식 직무명"
                value={data.jobStatus.title}
                onChange={(v: any) => handleChange("jobStatus.title", v)}
              />
              <InputField
                label="핵심 책임 (엔터로 구분)"
                value={data.jobStatus.responsibilities.join("\n")}
                multiline
                onChange={(v: any) =>
                  handleChange("jobStatus.responsibilities", v.split("\n"))
                }
              />
              <div className="grid grid-cols-2 gap-6">
                <InputField
                  label="의사결정 권한"
                  value={data.jobStatus.authority}
                  onChange={(v: any) => handleChange("jobStatus.authority", v)}
                />
                <InputField
                  label="보고 체계"
                  value={data.jobStatus.reportingLine}
                  onChange={(v: any) => handleChange("jobStatus.reportingLine", v)}
                />
              </div>
            </Section>

            <Section title="팀 미션 및 전략" color="yellow" icon={<Sparkles className="w-3 h-3" />}>
              <InputField
                label="팀 미션"
                value={data.jobStatus.teamMission}
                onChange={(v: any) => handleChange("jobStatus.teamMission", v)}
              />
              <InputField
                label="현재 핵심 목표"
                value={data.jobStatus.teamGoals?.join("\n") || ""}
                multiline
                onChange={(v: any) =>
                  handleChange("jobStatus.teamGoals", v.split("\n"))
                }
              />
            </Section>
          </div>
        )}

        {/* Tab 3: 과제 */}
        {activeTab === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Section title="최우선 과제 (Top 3 Priorities)" color="red" icon={<Clock className="w-4 h-4" />}>
              <ListEditor
                items={data.priorities}
                onRemove={(idx: number) => removeItem("priorities", idx)}
                renderItem={(p: any, i: number) => (
                  <div className="p-6 bg-white border border-red-50 rounded-3xl shadow-sm flex items-start gap-6">
                    <span className="w-8 h-8 bg-red-500 text-white rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 shadow-lg">
                      {i + 1}
                    </span>
                    <div className="flex-1 grid grid-cols-12 gap-6">
                      <div className="col-span-6">
                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">과제명</label>
                        <input
                          className="w-full text-xs font-black text-gray-800 outline-none bg-transparent"
                          value={p.title}
                          onChange={(e) => {
                            const next = [...data.priorities];
                            next[i].title = e.target.value;
                            handleChange("priorities", next);
                          }}
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">상태</label>
                        <input
                          className="w-full text-[10px] font-bold text-gray-500 outline-none bg-transparent"
                          value={p.status}
                          onChange={(e) => {
                            const next = [...data.priorities];
                            next[i].status = e.target.value;
                            handleChange("priorities", next);
                          }}
                        />
                      </div>
                      <div className="col-span-3 text-right">
                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">기한</label>
                        <input
                          className="w-full text-[10px] font-black text-red-500 outline-none bg-transparent text-right"
                          value={p.deadline}
                          onChange={(e) => {
                            const next = [...data.priorities];
                            next[i].deadline = e.target.value;
                            handleChange("priorities", next);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              />
            </Section>

            <div className="grid grid-cols-2 gap-6">
              <Section 
                title="핵심 관계자" 
                color="yellow" 
                onAdd={() => addItem("stakeholders.internal", { name: "이름", role: "역할" })}
              >
                <ListEditor
                  items={data.stakeholders.internal}
                  onRemove={(idx: number) => removeItem("stakeholders.internal", idx)}
                  renderItem={(s: any, i: number) => (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                      <div className="flex-1">
                        <input
                          className="w-full text-[11px] font-black text-gray-800 outline-none"
                          value={s.name}
                          onChange={(e) => {
                            const next = [...data.stakeholders.internal];
                            next[i].name = e.target.value;
                            handleChange("stakeholders.internal", next);
                          }}
                        />
                        <input
                          className="w-full text-[9px] font-bold text-gray-400 outline-none"
                          value={s.role}
                          onChange={(e) => {
                            const next = [...data.stakeholders.internal];
                            next[i].role = e.target.value;
                            handleChange("stakeholders.internal", next);
                          }}
                        />
                      </div>
                    </div>
                  )}
                />
              </Section>
              
              <Section 
                title="팀 구성원" 
                color="blue" 
                onAdd={() => addItem("teamMembers", { name: "이름", position: "직급", role: "역할", notes: "" })}
              >
                <ListEditor
                  items={data.teamMembers}
                  onRemove={(idx: number) => removeItem("teamMembers", idx)}
                  renderItem={(m: any, i: number) => (
                    <div className="p-3 bg-white rounded-xl shadow-sm border border-blue-100">
                      <input
                        className="w-full text-[11px] font-black text-gray-800 outline-none"
                        value={`${m.name} (${m.position})`}
                        onChange={(e) => {
                          const next = [...data.teamMembers];
                          const [name, pos] = e.target.value.split(" (");
                          next[i].name = name;
                          if (pos) next[i].position = pos.replace(")", "");
                          handleChange("teamMembers", next);
                        }}
                      />
                      <input
                        className="w-full text-[9px] font-bold text-blue-500 outline-none"
                        value={m.role}
                        onChange={(e) => {
                          const next = [...data.teamMembers];
                          next[i].role = e.target.value;
                          handleChange("teamMembers", next);
                        }}
                      />
                    </div>
                  )}
                />
              </Section>
            </div>
          </div>
        )}

        {/* Tab 4: 현황 */}
        {activeTab === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Section 
              title="프로젝트 진행 로드맵" 
              color="indigo" 
              onAdd={() => addItem("ongoingProjects", { name: "새 프로젝트", owner: "담당", status: "진행", progress: 0, deadline: "YYYY.MM.DD", description: "" })}
            >
              <ListEditor
                items={data.ongoingProjects}
                onRemove={(idx: number) => removeItem("ongoingProjects", idx)}
                renderItem={(p: any, i: number) => (
                  <div className="p-6 bg-white border border-indigo-50 rounded-[2rem] shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <input
                          className="text-sm font-black text-gray-800 outline-none bg-transparent"
                          value={p.name}
                          onChange={(e) => {
                            const next = [...data.ongoingProjects];
                            next[i].name = e.target.value;
                            handleChange("ongoingProjects", next);
                          }}
                        />
                        <input
                          className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full outline-none"
                          value={p.owner}
                          onChange={(e) => {
                            const next = [...data.ongoingProjects];
                            next[i].owner = e.target.value;
                            handleChange("ongoingProjects", next);
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          className="w-10 text-right text-xs font-black text-indigo-600 outline-none bg-transparent"
                          value={p.progress}
                          onChange={(e) => {
                            const next = [...data.ongoingProjects];
                            next[i].progress = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                            handleChange("ongoingProjects", next);
                          }}
                        />
                        <span className="text-xs font-black text-indigo-600">%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mb-4 shadow-inner">
                      <div className="bg-indigo-500 h-full transition-all duration-1000" style={{ width: `${p.progress}%` }}></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <InputField
                        label="진행 상황 / 기한"
                        value={`${p.status} / ${p.deadline}`}
                        onChange={(v: any) => {
                          const next = [...data.ongoingProjects];
                          const [status, deadline] = v.split(" / ");
                          next[i].status = status || "";
                          if (deadline) next[i].deadline = deadline;
                          handleChange("ongoingProjects", next);
                        }}
                      />
                      <InputField
                        label="상세 내용"
                        value={p.description}
                        onChange={(v: any) => {
                          const next = [...data.ongoingProjects];
                          next[i].description = v;
                          handleChange("ongoingProjects", next);
                        }}
                      />
                    </div>
                  </div>
                )}
              />
            </Section>

            <Section title="주요 이슈 및 리스크" color="red" icon={<AlertTriangle className="w-4 h-4" />}>
              <InputField
                label="현재 이슈"
                value={data.risks.issues}
                multiline
                onChange={(v: any) => handleChange("risks.issues", v)}
              />
              <InputField
                label="잠재적 리스크"
                value={data.risks.risks}
                multiline
                onChange={(v: any) => handleChange("risks.risks", v)}
              />
            </Section>
          </div>
        )}

        {/* Tab 5: 자료 */}
        {activeTab === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Section 
              title="핵심 문서 및 링크" 
              color="emerald" 
              onAdd={() => addItem("resources.docs", { category: "구분", name: "문서명", location: "경로" })}
            >
              <ListEditor
                items={data.resources.docs}
                onRemove={(idx: number) => removeItem("resources.docs", idx)}
                renderItem={(d: any, i: number) => (
                  <div className="flex gap-4 p-3 bg-white rounded-xl shadow-sm border border-emerald-100">
                    <input
                      className="w-16 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 rounded-lg outline-none"
                      value={d.category}
                      onChange={(e) => {
                        const next = [...data.resources.docs];
                        next[i].category = e.target.value;
                        handleChange("resources.docs", next);
                      }}
                    />
                    <div className="flex-1">
                      <input
                        className="w-full text-[11px] font-black text-gray-800 outline-none"
                        value={d.name}
                        onChange={(e) => {
                          const next = [...data.resources.docs];
                          next[i].name = e.target.value;
                          handleChange("resources.docs", next);
                        }}
                      />
                      <input
                        className="w-full text-[9px] font-bold text-gray-400 outline-none"
                        value={d.location}
                        onChange={(e) => {
                          const next = [...data.resources.docs];
                          next[i].location = e.target.value;
                          handleChange("resources.docs", next);
                        }}
                      />
                    </div>
                  </div>
                )}
              />
            </Section>

            <Section 
              title="운영 도구 및 시스템" 
              color="teal" 
              onAdd={() => addItem("resources.systems", { name: "시스템명", usage: "용도", contact: "담당자" })}
            >
              <ListEditor
                items={data.resources.systems}
                onRemove={(idx: number) => removeItem("resources.systems", idx)}
                renderItem={(s: any, i: number) => (
                  <div className="p-4 bg-white rounded-xl shadow-sm border border-teal-100">
                    <input
                      className="w-full text-xs font-black text-gray-800 outline-none mb-1"
                      value={s.name}
                      onChange={(e) => {
                        const next = [...data.resources.systems];
                        next[i].name = e.target.value;
                        handleChange("resources.systems", next);
                      }}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        className="w-full text-[10px] font-bold text-teal-600 outline-none"
                        value={s.usage}
                        onChange={(e) => {
                          const next = [...data.resources.systems];
                          next[i].usage = e.target.value;
                          handleChange("resources.systems", next);
                        }}
                      />
                      <input
                        className="w-full text-[10px] font-bold text-gray-400 outline-none text-right"
                        value={s.contact}
                        onChange={(e) => {
                          const next = [...data.resources.systems];
                          next[i].contact = e.target.value;
                          handleChange("resources.systems", next);
                        }}
                      />
                    </div>
                  </div>
                )}
              />
            </Section>
          </div>
        )}

        {/* Tab 6: 확인 */}
        {activeTab === 5 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Section title="인수인계 최종 체크리스트" color="yellow" icon={<CheckSquare className="w-5 h-5 text-yellow-500" />}>
              <ListEditor
                items={data.checklist}
                onRemove={(idx: number) => removeItem("checklist", idx)}
                renderItem={(c: any, i: number) => (
                  <label className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-yellow-50 shadow-sm cursor-pointer hover:bg-yellow-50/30 transition-all group/item">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={c.completed}
                        onChange={(e) => {
                          const next = [...data.checklist];
                          next[i].completed = e.target.checked;
                          handleChange("checklist", next);
                        }}
                        className="w-6 h-6 rounded-lg border-2 border-yellow-200 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-0 transition-all cursor-pointer appearance-none checked:bg-yellow-500 checked:border-yellow-500"
                      />
                      {c.completed && (
                        <CheckSquare className="w-4 h-4 text-white absolute pointer-events-none" />
                      )}
                    </div>
                    <input
                      className={`flex-1 text-[11px] font-bold outline-none bg-transparent transition-all ${
                        c.completed ? "text-gray-300 line-through" : "text-gray-700"
                      }`}
                      value={c.text}
                      onChange={(e) => {
                        const next = [...data.checklist];
                        next[i].text = e.target.value;
                        handleChange("checklist", next);
                      }}
                    />
                  </label>
                )}
              />
            </Section>

            <div className="p-10 bg-yellow-400 rounded-[3rem] text-center shadow-2xl relative overflow-hidden group/confirm">
              <div className="absolute top-0 right-0 p-8 opacity-10 animate-pulse">
                <Sparkles className="w-48 h-48 text-white" />
              </div>
              <p className="text-lg font-black italic mb-10 leading-relaxed text-white">
                "본 인수인계서의 모든 내용에 대해 인계자로부터 충분한 설명을
                들었으며,
                <br />
                관련 자료를 모두 정상적으로 전달받았음을 공식적으로 확인합니다."
              </p>

              <div className="grid grid-cols-3 gap-10 pt-10 border-t border-white/20">
                <div className="flex flex-col items-center">
                  <input
                    className="w-full bg-transparent border-b-2 border-dashed border-white/40 text-center text-white font-black text-sm outline-none focus:border-white transition-all pb-2 placeholder:text-white/40"
                    placeholder="(서명)"
                    value={data.overview.transferor.name}
                    onChange={(e) => handleChange("overview.transferor.name", e.target.value)}
                  />
                  <span className="text-[9px] font-black mt-2 text-white/80 uppercase tracking-widest">인계자</span>
                </div>
                <div className="flex flex-col items-center">
                  <input
                    className="w-full bg-transparent border-b-2 border-dashed border-white/40 text-center text-white font-black text-sm outline-none focus:border-white transition-all pb-2 placeholder:text-white/40"
                    placeholder="(서명)"
                    value={data.overview.transferee.name}
                    onChange={(e) => handleChange("overview.transferee.name", e.target.value)}
                  />
                  <span className="text-[9px] font-black mt-2 text-white/80 uppercase tracking-widest">인수자</span>
                </div>
                <div className="flex flex-col items-center">
                  <input
                    className="w-full bg-transparent border-b-2 border-dashed border-white/40 text-center text-white font-black text-sm outline-none focus:border-white transition-all pb-2 placeholder:text-white/40"
                    placeholder="YYYY.MM.DD"
                    value={data.overview.period || new Date().toLocaleDateString()}
                    onChange={(e) => handleChange("overview.period", e.target.value)}
                  />
                  <span className="text-[9px] font-black mt-2 text-white/80 uppercase tracking-widest">확인 일자</span>
                </div>
              </div>

              <div className="mt-12 flex justify-center">
                <div className="w-64 flex flex-col items-center">
                  <input
                    className="w-full bg-transparent border-b-2 border-dashed border-white/40 text-center text-white font-black text-sm outline-none focus:border-white transition-all pb-2 placeholder:text-white/40"
                    placeholder="(전자서명)"
                    value={data.stakeholders.manager || ""}
                    onChange={(e) => handleChange("stakeholders.manager", e.target.value)}
                  />
                  <span className="text-[9px] font-black mt-2 text-white/80 uppercase tracking-widest text-center">최종 매니저 확인 서명</span>
                </div>
              </div>
            </div>

            <div className="p-8 bg-gray-900 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group/final">
              <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-yellow-400/20 transition-all duration-1000"></div>
              <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-yellow-400" /> 거의 다 됐어요!
              </h3>
              <p className="text-gray-400 text-xs font-bold leading-relaxed mb-8">
                작성하신 내용은 실시간으로 저장됩니다.
                <br />
                모든 내용이 정확한지 인계자/인수자와 함께 확인한 후 PDF로 저장해 주세요.
              </p>
              <button
                onClick={handleExportPDF}
                className="w-full py-4 bg-yellow-400 text-gray-900 rounded-2xl text-sm font-black hover:bg-yellow-500 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
              >
                <Download className="w-5 h-5" /> 완성된 인수인계서 PDF 저장하기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Honey Progress Indicator */}
      <div className="bg-yellow-400 h-1.5 w-full">
        <div
          className="bg-white/40 h-full transition-all duration-500"
          style={{ width: `${((activeTab + 1) / tabs.length) * 100}%` }}
        ></div>
      </div>
    </div>
  );
};

export default HandoverForm;
