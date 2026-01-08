import React from "react";
import { HandoverData } from "../types";

interface Props {
  data: HandoverData;
}

export const HandoverPrintTemplate: React.FC<Props> = ({ data }) => {
  return (
    <div className="print-template hidden print:block bg-white text-black p-8 font-serif leading-relaxed">
      {/* Header */}
      <div className="text-center border-b-2 border-black pb-4 mb-8">
        <h1 className="text-3xl font-bold tracking-widest mb-2">업무 인수인계서</h1>
        <p className="text-sm text-gray-600">
          작성일: {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* 1. 기본 정보 */}
      <section className="mb-8 break-inside-avoid">
        <h2 className="text-lg font-bold mb-2 border-l-4 border-black pl-2 uppercase">
          1. 기본 정보
        </h2>
        <table className="w-full border-collapse border border-black text-sm">
          <tbody>
            <tr>
              <th className="border border-black bg-gray-100 p-2 w-24 text-center">
                인계자
              </th>
              <td className="border border-black p-2">
                {data.overview.transferor.name || "(이름)"} /{" "}
                {data.overview.transferor.position || "(직급)"}
              </td>
              <th className="border border-black bg-gray-100 p-2 w-24 text-center">
                인수자
              </th>
              <td className="border border-black p-2">
                {data.overview.transferee.name || "(이름)"} /{" "}
                {data.overview.transferee.position || "(직급)"}
              </td>
            </tr>
            <tr>
              <th className="border border-black bg-gray-100 p-2 text-center">
                인계 기간
              </th>
              <td className="border border-black p-2" colSpan={3}>
                {data.overview.period || "-"}
              </td>
            </tr>
            <tr>
              <th className="border border-black bg-gray-100 p-2 text-center">
                인계 사유
              </th>
              <td className="border border-black p-2 h-20 align-top" colSpan={3}>
                {data.overview.reason}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 2. 직무 개요 */}
      <section className="mb-8 break-inside-avoid">
        <h2 className="text-lg font-bold mb-2 border-l-4 border-black pl-2 uppercase">
          2. 직무 개요
        </h2>
        <table className="w-full border-collapse border border-black text-sm">
          <tbody>
            <tr>
              <th className="border border-black bg-gray-100 p-2 w-32 text-center">
                직무명
              </th>
              <td className="border border-black p-2">
                {data.jobStatus.title}
              </td>
            </tr>
            <tr>
              <th className="border border-black bg-gray-100 p-2 text-center">
                주요 책임
              </th>
              <td className="border border-black p-2">
                <ul className="list-disc pl-5 space-y-1">
                  {data.jobStatus.responsibilities.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 3. 주요 과제 및 현황 (Top 3) */}
      <section className="mb-8 break-inside-avoid">
        <h2 className="text-lg font-bold mb-2 border-l-4 border-black pl-2 uppercase">
          3. 주요 과제 및 현황
        </h2>
        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 w-16 text-center">No</th>
              <th className="border border-black p-2 text-center">과제명</th>
              <th className="border border-black p-2 w-24 text-center">상태</th>
              <th className="border border-black p-2 w-32 text-center">기한</th>
            </tr>
          </thead>
          <tbody>
            {data.priorities.map((p, i) => (
              <tr key={i}>
                <td className="border border-black p-2 text-center">{i + 1}</td>
                <td className="border border-black p-2 font-bold">{p.title}</td>
                <td className="border border-black p-2 text-center">
                  {p.status}
                </td>
                <td className="border border-black p-2 text-center">
                  {p.deadline}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 4. 진행 중인 프로젝트 */}
      <section className="mb-8 break-inside-avoid">
        <h2 className="text-lg font-bold mb-2 border-l-4 border-black pl-2 uppercase">
          4. 진행 중인 프로젝트
        </h2>
        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2">프로젝트명</th>
              <th className="border border-black p-2 w-20">담당</th>
              <th className="border border-black p-2 w-16">진척도</th>
              <th className="border border-black p-2">세부 내용</th>
            </tr>
          </thead>
          <tbody>
            {(data.ongoingProjects || []).map((p, i) => (
              <tr key={i}>
                <td className="border border-black p-2 font-bold">{p.name}</td>
                <td className="border border-black p-2 text-center">
                  {p.owner}
                </td>
                <td className="border border-black p-2 text-center">
                  {p.progress}%
                </td>
                <td className="border border-black p-2 text-xs">
                  {p.description}
                </td>
              </tr>
            ))}
            {data.ongoingProjects?.length === 0 && (
              <tr>
                <td colSpan={4} className="border border-black p-4 text-center text-gray-400">
                  진행 중인 프로젝트가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* 5. 참고 자료 및 리스크 */}
      <div className="grid grid-cols-2 gap-8 mb-8 break-inside-avoid">
        <section>
          <h2 className="text-lg font-bold mb-2 border-l-4 border-black pl-2 uppercase">
            5. 리스크 및 이슈
          </h2>
          <div className="border border-black p-4 text-sm h-full min-h-[100px]">
             <h4 className="font-bold underline mb-1">현재 이슈:</h4>
             <p className="mb-4 whitespace-pre-wrap">{data.risks.issues || "없음"}</p>
             <h4 className="font-bold underline mb-1">잠재적 리스크:</h4>
             <p className="whitespace-pre-wrap">{data.risks.risks || "없음"}</p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2 border-l-4 border-black pl-2 uppercase">
            6. 참고 문서
          </h2>
           <ul className="border border-black p-4 text-sm h-full min-h-[100px] list-disc pl-6 space-y-1">
              {data.resources.docs.map((d, i) => (
                  <li key={i}>
                      <span className="font-bold">[{d.category}]</span> {d.name} <br/>
                      <span className="text-xs text-gray-500">({d.location})</span>
                  </li>
              ))}
           </ul>
        </section>
      </div>

      {/* 서명란 */}
      <section className="mt-12 pt-8 border-t-2 border-gray-300 break-inside-avoid">
        <p className="text-center text-sm mb-12">
          상기 내용을 정확히 인계하였으며, 인수자는 이를 확인하고 업무를 인수합니다.
        </p>
        <div className="flex justify-around text-center">
          <div>
            <p className="text-sm font-bold mb-8">인계자</p>
            <div className="text-xl font-serif border-b border-black pb-2 w-32 mx-auto">
              {data.overview.transferor.name || "(서명)"}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold mb-8">인수자</p>
            <div className="text-xl font-serif border-b border-black pb-2 w-32 mx-auto">
              {data.overview.transferee.name || "(서명)"}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold mb-8">확인자 (부서장)</p>
            <div className="text-xl font-serif border-b border-black pb-2 w-32 mx-auto">
              {data.stakeholders.manager || "(서명)"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
