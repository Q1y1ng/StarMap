// ── 知识图谱服务（Phase 9） ──
// 提供树状知识图谱的查询与遍历
// ────────────────────────────────

import { prisma } from '@/lib/prisma'

// ── Types ──

export type KnowledgeNodeDTO = {
  id: string
  subject: string
  name: string
  parentId: string | null
  level: number
  description: string | null
  childrenCount: number
  /** 可选：子节点列表（树状返回时填充） */
  children?: KnowledgeNodeDTO[]
}

export type KnowledgeEdgeDTO = {
  id: string
  sourceId: string
  targetId: string
  sourceName: string
  targetName: string
  relationType: string
}

export type NodePathItem = {
  id: string
  name: string
  level: number
}

export type NodeDetailDTO = {
  node: KnowledgeNodeDTO
  path: NodePathItem[]
  prerequisites: { id: string; name: string; subject: string }[]
  relatedNodes: { id: string; name: string; subject: string; relationType: string }[]
  /** 掌握率历史（如果有数据） */
  masteryHistory: { examDate: string; mastery: number; score: number; fullScore: number }[]
  /** 关联错题 */
  wrongQuestions: { id: string; questionNo: number; examTitle: string; wrongCount: number }[]
}

// ── Service ──

export class KnowledgeGraphService {
  /**
   * 获取所有科目列表
   */
  static async getSubjects(): Promise<string[]> {
    const result = await prisma.knowledgeNode.findMany({
      select: { subject: true },
      distinct: ['subject'],
      orderBy: { subject: 'asc' },
    })
    return result.map((r) => r.subject)
  }

  /**
   * 查找单个节点（含子节点数量）
   */
  static async findNode(id: string): Promise<KnowledgeNodeDTO | null> {
    const node = await prisma.knowledgeNode.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } },
    })
    if (!node) return null

    return {
      id: node.id,
      subject: node.subject,
      name: node.name,
      parentId: node.parentId,
      level: node.level,
      description: node.description,
      childrenCount: node._count.children,
    }
  }

  /**
   * 按名称查找节点（科目内唯一）
   */
  static async findNodeByName(subject: string, name: string): Promise<KnowledgeNodeDTO | null> {
    const node = await prisma.knowledgeNode.findUnique({
      where: { subject_name: { subject, name } },
      include: { _count: { select: { children: true } } },
    })
    if (!node) return null

    return {
      id: node.id,
      subject: node.subject,
      name: node.name,
      parentId: node.parentId,
      level: node.level,
      description: node.description,
      childrenCount: node._count.children,
    }
  }

  /**
   * 获取某个科目的完整知识树（根节点列表）
   */
  static async getTree(subject: string): Promise<KnowledgeNodeDTO[]> {
    const roots = await prisma.knowledgeNode.findMany({
      where: { subject, parentId: null },
      orderBy: { name: 'asc' },
    })

    const tree: KnowledgeNodeDTO[] = []
    for (const root of roots) {
      tree.push(await this.buildSubTree(root.id))
    }
    return tree
  }

  /**
   * 获取节点的直接子节点
   */
  static async getChildren(parentId: string): Promise<KnowledgeNodeDTO[]> {
    const children = await prisma.knowledgeNode.findMany({
      where: { parentId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { children: true } } },
    })

    return children.map((c) => ({
      id: c.id,
      subject: c.subject,
      name: c.name,
      parentId: c.parentId,
      level: c.level,
      description: c.description,
      childrenCount: c._count.children,
    }))
  }

  /**
   * 获取从根到指定节点的路径
   */
  static async getPath(nodeId: string): Promise<NodePathItem[]> {
    const path: NodePathItem[] = []
    let current = await prisma.knowledgeNode.findUnique({
      where: { id: nodeId },
      select: { id: true, name: true, level: true, parentId: true },
    })

    while (current) {
      path.unshift({ id: current.id, name: current.name, level: current.level })
      if (current.parentId) {
        current = await prisma.knowledgeNode.findUnique({
          where: { id: current.parentId },
          select: { id: true, name: true, level: true, parentId: true },
        })
      } else {
        current = null
      }
    }

    return path
  }

  /**
   * 获取节点详细信息（含掌握率、错题、关联知识点）
   */
  static async getNodeDetail(nodeId: string): Promise<NodeDetailDTO | null> {
    const node = await this.findNode(nodeId)
    if (!node) return null

    // 路径
    const path = await this.getPath(nodeId)

    // 关联边：先修和关联
    const edges = await prisma.knowledgeEdge.findMany({
      where: {
        OR: [{ sourceId: nodeId }, { targetId: nodeId }],
      },
      include: {
        source: { select: { id: true, name: true, subject: true } },
        target: { select: { id: true, name: true, subject: true } },
      },
    })

    const prerequisites = edges
      .filter((e) => e.relationType === 'prerequisite' && e.targetId === nodeId)
      .map((e) => ({ id: e.source.id, name: e.source.name, subject: e.source.subject }))

    const relatedNodes = edges
      .filter((e) => e.relationType === 'related')
      .map((e) => {
        const related = e.sourceId === nodeId ? e.target : e.source
        return { id: related.id, name: related.name, subject: related.subject, relationType: 'related' as const }
      })

    // 掌握率历史：从 KnowledgeMasteryHistory 查询 (subject + name)
    // 先精确匹配，若无结果则模糊匹配（AI 分析名与标准节点名可能不一致）
    let masteryHistory = await prisma.knowledgeMasteryHistory.findMany({
      where: { subject: node.subject, knowledgePoint: node.name },
      orderBy: { examDate: 'asc' },
      select: { examDate: true, mastery: true, score: true, fullScore: true },
    })

    if (masteryHistory.length === 0) {
      // 模糊匹配：查找知识点名包含该节点名的记录
      masteryHistory = await prisma.knowledgeMasteryHistory.findMany({
        where: {
          subject: node.subject,
          knowledgePoint: { contains: node.name },
        },
        orderBy: { examDate: 'asc' },
        select: { examDate: true, mastery: true, score: true, fullScore: true },
      })
    }

    // 关联错题：从 WrongQuestion 查询
    const wrongQuestions = await prisma.wrongQuestion.findMany({
      where: { subject: node.subject, knowledgePoint: node.name },
      orderBy: { wrongCount: 'desc' },
      take: 10,
      select: {
        id: true,
        wrongCount: true,
        question: { select: { questionNo: true } },
        exam: { select: { title: true } },
      },
    })

    return {
      node,
      path,
      prerequisites,
      relatedNodes,
      masteryHistory: masteryHistory.map((h) => ({
        examDate: h.examDate.toISOString(),
        mastery: h.mastery,
        score: h.score,
        fullScore: h.fullScore,
      })),
      wrongQuestions: wrongQuestions.map((wq) => ({
        id: wq.id,
        questionNo: wq.question.questionNo,
        examTitle: wq.exam.title,
        wrongCount: wq.wrongCount,
      })),
    }
  }

  /**
   * 搜索知识点
   */
  static async searchNodes(query: string, subject?: string): Promise<KnowledgeNodeDTO[]> {
    const where: Record<string, unknown> = {
      name: { contains: query },
    }
    if (subject) where.subject = subject

    const nodes = await prisma.knowledgeNode.findMany({
      where,
      orderBy: [{ subject: 'asc' }, { level: 'asc' }, { name: 'asc' }],
      take: 20,
      include: { _count: { select: { children: true } } },
    })

    return nodes.map((n) => ({
      id: n.id,
      subject: n.subject,
      name: n.name,
      parentId: n.parentId,
      level: n.level,
      description: n.description,
      childrenCount: n._count.children,
    }))
  }

  // ── Private helpers ──

  /**
   * 递归构建子树
   */
  private static async buildSubTree(nodeId: string): Promise<KnowledgeNodeDTO> {
    const node = await prisma.knowledgeNode.findUnique({
      where: { id: nodeId },
      include: { _count: { select: { children: true } } },
    })
    if (!node) throw new Error(`Node not found: ${nodeId}`)

    const dto: KnowledgeNodeDTO = {
      id: node.id,
      subject: node.subject,
      name: node.name,
      parentId: node.parentId,
      level: node.level,
      description: node.description,
      childrenCount: node._count.children,
    }

    if (dto.childrenCount > 0) {
      const children = await prisma.knowledgeNode.findMany({
        where: { parentId: nodeId },
        orderBy: { name: 'asc' },
      })
      dto.children = []
      for (const child of children) {
        dto.children.push(await this.buildSubTree(child.id))
      }
    }

    return dto
  }
}
