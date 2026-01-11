import React from "react";
import { HandoverData } from "../types";

interface Props {
  data: HandoverData;
}

export const HandoverPrintTemplate: React.FC<Props> = ({ data }) => {
  return (
    <div className="print-template hidden print:block bg-white text-black p-0 font-sans leading-tight">
      {/* Header */}
      <div className="text-center border-b-4 border-black pb-6 mb-10">
        <h1 className="text-4xl font-extrabold tracking-[0.2em] mb-3 uppercase">업무 인수인계서</h1>
        <div className="flex justify-between items-end px-2">
          <p className="text-xs font-bold text-gray-500">
            문서번호: HO-{new Date().getFullYear()}-{Math.floor(Math.random() * 10000).toString().padStart(4, '0')}
          </p>
          <p className="text-sm font-bold">
            작성일: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* 1. 기본 정보 */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="text-lg font-black mb-3 border-b-2 border-black inline-block pr-10 uppercase tracking-widest">
          01. 기본 정보
        </h2>
        <table className="w-full border-collapse border-2 border-black text-sm">
          <tbody>
            <tr>
              <th className="border border-black bg-gray-50 p-3 w-32 text-center font-bold">
                인계자
              </th>
              <td className="border border-black p-3 w-1/3">
                {data.overview.transferor.name || "(성함)"} / {data.overview.transferor.position || "(직위/부서)"}
              </td>
              <th className="border border-black bg-gray-50 p-3 w-32 text-center font-bold">
                인수자
              </th>
              <td className="border border-black p-3">
                {data.overview.transferee.name || "(성함)"} / {data.overview.transferee.position || "(직위/부서)"}
              </td>
            </tr>
            <tr>
              <th className="border border-black bg-gray-50 p-3 text-center font-bold">
                인계 기간
              </th>
              <td className="border border-black p-3" colSpan={3}>
                {data.overview.period || "해당 없음"}
              </td>
            </tr>
            <tr>
              <th className="border border-black bg-gray-50 p-3 text-center font-bold">
                인계 사유
              </th>
              <td className="border border-black p-3 h-24 align-top" colSpan={3}>
                {data.overview.reason || "상세 내용 없음"}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 2. 직무 개요 */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="text-lg font-black mb-3 border-b-2 border-black inline-block pr-10 uppercase tracking-widest">
          02. 직무 개요
        </h2>
        <table className="w-full border-collapse border-2 border-black text-sm">
          <tbody>
            <tr>
              <th className="border border-black bg-gray-50 p-3 w-32 text-center font-bold">
                담당 직무명
              </th>
              <td className="border border-black p-3 font-bold">
                {data.jobStatus?.title}
              </td>
            </tr>
            <tr>
              <th className="border border-black bg-gray-50 p-3 text-center font-bold">
                주요 책임
              </th>
              <td className="border border-black p-3">
                <ul className="list-disc pl-6 space-y-2">
                  {(data.jobStatus?.responsibilities || []).map((r, i) => (
                    <li key={i} className="text-gray-800">{r}</li>
                  ))}
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 3. 주요 과제 및 현황 */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="text-lg font-black mb-3 border-b-2 border-black inline-block pr-10 uppercase tracking-widest">
          03. 주요 과제 및 현황
        </h2>
        <table className="w-full border-collapse border-2 border-black text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-black p-3 w-16 text-center font-bold">No</th>
              <th className="border border-black p-3 text-center font-bold">과제명</th>
              <th className="border border-black p-3 w-28 text-center font-bold">현재 상태</th>
              <th className="border border-black p-3 w-32 text-center font-bold">완료 기한</th>
            </tr>
          </thead>
          <tbody>
            {(data.priorities || []).map((p, i) => (
              <tr key={i}>
                <td className="border border-black p-3 text-center font-mono">{i + 1}</td>
                <td className="border border-black p-3 bg-white font-bold">{p.title}</td>
                <td className="border border-black p-3 text-center">
                  <span className="px-2 py-1 border border-black text-[10px] font-bold uppercase">{p.status}</span>
                </td>
                <td className="border border-black p-3 text-center font-mono">
                  {p.deadline}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 4. 진행 프로젝트 */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="text-lg font-black mb-3 border-b-2 border-black inline-block pr-10 uppercase tracking-widest">
          04. 진행 프로젝트 상세
        </h2>
        <table className="w-full border-collapse border-2 border-black text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-black p-3 w-1/4 text-center font-bold">프로젝트명</th>
              <th className="border border-black p-3 w-20 text-center font-bold">담당자</th>
              <th className="border border-black p-3 w-20 text-center font-bold">진척도</th>
              <th className="border border-black p-3 text-center font-bold">세부 추진 내용</th>
            </tr>
          </thead>
          <tbody>
            {(data.ongoingProjects || []).map((p, i) => (
              <tr key={i}>
                <td className="border border-black p-3 font-bold">{p.name}</td>
                <td className="border border-black p-3 text-center">
                  {p.owner}
                </td>
                <td className="border border-black p-3 text-center font-mono">
                  {p.progress}%
                </td>
                <td className="border border-black p-3 text-xs leading-normal bg-gray-50/30">
                  {p.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 5. 리스크 및 이슈 */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="text-lg font-black mb-3 border-b-2 border-black inline-block pr-10 uppercase tracking-widest">
          05. 리스크 및 이슈
        </h2>
        <div className="border-2 border-black p-4 text-sm bg-white">
          <div className="mb-4">
            <h4 className="font-bold border-l-4 border-black pl-2 mb-2">현재 주요 이슈</h4>
            <p className="whitespace-pre-wrap text-gray-700 leading-snug">{data.risks?.issues || "기재 사항 없음"}</p>
          </div>
          <div>
            <h4 className="font-bold border-l-4 border-black pl-2 mb-2">잠재적 리스크</h4>
            <p className="whitespace-pre-wrap text-gray-700 leading-snug">{data.risks?.risks || "기재 사항 없음"}</p>
          </div>
        </div>
      </section>

      {/* 6. 참고 문서 목록 */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="text-lg font-black mb-3 border-b-2 border-black inline-block pr-10 uppercase tracking-widest">
          06. 참고 문서 목록
        </h2>
        <div className="border-2 border-black p-4 text-sm bg-white">
          <ul className="list-disc pl-5 space-y-3">
            {(data.resources?.docs || []).map((d, i) => (
              <li key={i}>
                <div className="font-bold">[{d.category}] {d.name}</div>
                <div className="text-[10px] text-gray-400 font-mono italic">{d.location}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 서명란 */}
      <section className="mt-20 pt-10 border-t-4 border-black break-inside-avoid">
        <p className="text-center text-sm font-bold mb-16">
          상기 업무 및 관련 자료 일체를 정확히 인계하였으며, 인수자는 이를 확인하고 업무를 인수함에 동의함.
        </p>
        <div className="grid grid-cols-3 gap-10 text-center">
          <div>
            <p className="text-xs font-black text-gray-500 mb-10 uppercase tracking-widest">인계자</p>
            <div className="text-xl font-bold border-b-2 border-black pb-2 w-40 mx-auto italic">
              {data.overview.transferor.name || "(서명)"}
            </div>
          </div>
          <div>
            <p className="text-xs font-black text-gray-500 mb-10 uppercase tracking-widest">인수자</p>
            <div className="text-xl font-bold border-b-2 border-black pb-2 w-40 mx-auto italic">
              {data.overview.transferee.name || "(서명)"}
            </div>
          </div>
          <div>
            <p className="text-xs font-black text-gray-500 mb-10 uppercase tracking-widest">최종 승인 (부서장)</p>
            <div className="text-xl font-bold border-b-2 border-black pb-2 w-40 mx-auto italic">
              {data.stakeholders?.manager || "(서명)"}
            </div>
          </div>
        </div>
        <div className="mt-16 text-center text-[10px] text-gray-400 font-bold tracking-tighter">
          본 문서는 보안 문서로 무단 복제 및 외부 유출을 금지함. COPYRIGHT {new Date().getFullYear()} 꿀단지 RAG ALL RIGHTS RESERVED.
        </div>
      </section>
    </div>
  );
};
