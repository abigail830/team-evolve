import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateGlossaryEmbedding } from '@/lib/embedding-service'
import { z } from 'zod'

// 获取术语列表
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const domain = searchParams.get('domain')
  const status = searchParams.get('status')
  const term = searchParams.get('term')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  try {
    // 构建查询条件
    const where: any = {}
    
    if (domain) {
      where.domain = domain
    }
    
    if (status) {
      where.status = status
    }
    
    if (term) {
      where.term = {
        contains: term,
        mode: 'insensitive'
      }
    }
    
    // 获取总记录数
    const total = await prisma.glossary.count({ where })
    
    // 获取分页数据
    const items = await prisma.glossary.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    })
    
    return NextResponse.json({
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('获取术语失败:', error)
    return NextResponse.json(
      { error: '获取术语失败' },
      { status: 500 }
    )
  }
}

// 添加新术语
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // 定义请求格式验证
    const schema = z.object({
      term: z.string().min(1, "术语名称不能为空"),
      english: z.string().optional(),
      explanation: z.string().min(1, "术语解释不能为空"),
      domain: z.string().optional(),
      status: z.enum(["pending", "approved"]).default("pending"),
      createdBy: z.string().optional(),
    })
    
    // 验证请求体
    const { term, english, explanation, domain, status, createdBy } = schema.parse(body)
    
    // 检查是否已存在相同术语
    const existing = await prisma.glossary.findFirst({
      where: { term: { equals: term, mode: 'insensitive' } }
    })
    
    if (existing) {
      return NextResponse.json(
        { error: `术语 "${term}" 已存在` },
        { status: 400 }
      )
    }
    
    try {
      // 生成向量嵌入
      const embedding = await generateGlossaryEmbedding(term, explanation, english)
      
      // 创建术语记录
      const glossary = await prisma.glossary.create({
        data: {
          term,
          english: english || "", 
          explanation,
          domain: domain || "qare",
          status,
          embedding,
          createdBy: createdBy || null,
        },
      })
      
      return NextResponse.json({
        id: glossary.id,
        term: glossary.term,
        message: `术语 "${term}" 已成功添加`
      })
    } catch (embedError) {
      console.error('无法生成嵌入向量，仍将保存术语:', embedError)
      
      // 即使无法生成嵌入也保存术语
      const glossary = await prisma.glossary.create({
        data: {
          term,
          english: english || "",
          explanation,
          domain: domain || "qare",
          status,
          // 不包含embedding字段
          createdBy: createdBy || null,
        },
      })
      
      return NextResponse.json({
        id: glossary.id,
        term: glossary.term,
        message: `术语 "${term}" 已添加，但无法生成向量嵌入`
      })
    }
  } catch (error) {
    console.error('术语添加失败:', error)
    return NextResponse.json(
      { error: '术语添加失败' },
      { status: 500 }
    )
  }
} 