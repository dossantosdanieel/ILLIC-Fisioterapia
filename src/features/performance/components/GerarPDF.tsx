import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buscarDadosRelatorioPaciente } from '../api'
import type { DadosRelatorioPaciente } from '../api'

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

async function gerarPDF(dados: DadosRelatorioPaciente) {
  // Import dinâmico para não bloquear o bundle principal
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const margem = 16
  let y = margem

  // ── Cabeçalho ──────────────────────────────────────────
  doc.setFillColor(37, 99, 235) // blue-600
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('ILLIC — Relatório de Reabilitação', margem, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Emitido em ${formatarData(new Date().toISOString())}`, margem, 20)
  doc.text(`Fisioterapeuta: ${dados.fisio.nome}${dados.fisio.crefito ? ` | CREFITO: ${dados.fisio.crefito}` : ''}`, W / 2, 20, { align: 'center' })
  y = 36

  // ── Dados do paciente ───────────────────────────────────
  doc.setTextColor(17, 24, 39) // gray-900
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Identificação do Paciente', margem, y)
  y += 7

  const infoPaciente = [
    ['Nome', dados.paciente.nome],
    ['Data de nascimento', dados.paciente.data_nascimento ? formatarData(dados.paciente.data_nascimento) : '—'],
    ['Diagnóstico', dados.paciente.diagnostico ?? '—'],
    ['Convênio / Plano', dados.paciente.convenio_plano ?? '—'],
    ['Consentimento LGPD', dados.paciente.consentimento_lgpd
      ? `Registrado em ${dados.paciente.data_consentimento ? formatarData(dados.paciente.data_consentimento) : 'data não informada'}`
      : 'Não registrado'],
  ]

  autoTable(doc, {
    startY: y,
    head: [],
    body: infoPaciente,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, textColor: [75, 85, 99] }, 1: { textColor: [17, 24, 39] } },
    margin: { left: margem, right: margem },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ── Plano de tratamento ─────────────────────────────────
  if (dados.plano) {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Plano de Tratamento', margem, y)
    y += 7

    autoTable(doc, {
      startY: y,
      head: [],
      body: [
        ['Início', formatarData(dados.plano.data_av_inicial)],
        ['Prognóstico', `${dados.plano.prognostico_semanas} semanas`],
        ['Frequência', `${dados.plano.frequencia_semanal}× por semana`],
        ['Status', dados.plano.status.toUpperCase()],
        ['Objetivos', dados.plano.objetivos.join('\n') || '—'],
      ],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, textColor: [75, 85, 99] } },
      margin: { left: margem, right: margem },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

    // Fases
    if (dados.fases.length > 0) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Fases do Protocolo', margem, y)
      y += 5

      autoTable(doc, {
        startY: y,
        head: [['Fase', 'Semanas', 'Critérios de avanço']],
        body: dados.fases.map(f => [
          f.nome,
          `${f.semana_inicio}–${f.semana_fim}`,
          f.criterios.length > 0
            ? f.criterios.map(c => `${c.medida_nome} ${c.operador} ${c.valor_alvo}`).join('\n')
            : '—',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
        styles: { fontSize: 8.5, cellPadding: 2 },
        margin: { left: margem, right: margem },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    }
  }

  // ── Avaliações ──────────────────────────────────────────
  if (dados.avaliacoes.length > 0) {
    // Nova página se necessário
    if (y > 220) { doc.addPage(); y = margem }

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Histórico de Avaliações', margem, y)
    y += 7

    for (const av of dados.avaliacoes) {
      if (y > 240) { doc.addPage(); y = margem }
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(
        `${av.tipo === 'inicial' ? 'Avaliação Inicial' : 'Reavaliação'} — ${formatarData(av.data)}`,
        margem, y,
      )
      y += 4

      if (av.valores.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['Medida', 'Valor', 'Unidade']],
          body: av.valores.map(v => [v.medida, String(v.valor), v.unidade]),
          theme: 'striped',
          headStyles: { fillColor: [99, 102, 241], textColor: 255, fontSize: 8 },
          styles: { fontSize: 8.5, cellPadding: 1.5 },
          margin: { left: margem, right: margem },
        })
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5
      }
    }
    y += 3
  }

  // ── Sessões ─────────────────────────────────────────────
  if (dados.sessoes.length > 0) {
    if (y > 220) { doc.addPage(); y = margem }

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Histórico de Sessões (últimas 20)', margem, y)
    y += 7

    autoTable(doc, {
      startY: y,
      head: [['Data', 'Exercícios realizados', 'Fidelidade ao protocolo']],
      body: dados.sessoes.map(s => [
        formatarData(s.data),
        `${s.realizados}/${s.total}`,
        `${s.fidelidade}%`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        2: {
          fontStyle: 'bold',
        },
      },
      didParseCell: (data) => {
        if (data.column.index === 2 && data.section === 'body') {
          const val = parseInt(data.cell.raw as string)
          data.cell.styles.textColor = val >= 90 ? [22, 163, 74] : val >= 70 ? [217, 119, 6] : [220, 38, 38]
        }
      },
      margin: { left: margem, right: margem },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // ── Rodapé em todas as páginas ──────────────────────────
  const totalPaginas = doc.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(156, 163, 175) // gray-400
    doc.text(
      'ILLIC Sistema de Reabilitação — Documento de uso interno. Não substitui o prontuário oficial.',
      W / 2, 290, { align: 'center' },
    )
    doc.text(`Página ${i} de ${totalPaginas}`, W - margem, 290, { align: 'right' })
  }

  // Salvar
  const nomeArquivo = `ILLIC_${dados.paciente.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(nomeArquivo)
}

interface Props { pacienteId: string; pacienteNome?: string }

export function BotaoGerarPDF({ pacienteId }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleGerar() {
    setLoading(true)
    try {
      const dados = await buscarDadosRelatorioPaciente(pacienteId)
      await gerarPDF(dados)
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      alert('Erro ao gerar relatório. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleGerar} loading={loading}>
      <FileText size={14} /> Exportar PDF
    </Button>
  )
}
