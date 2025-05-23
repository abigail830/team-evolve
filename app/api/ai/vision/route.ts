import { NextRequest, NextResponse } from "next/server";
import { QwenVLService } from "@/lib/services/qwen-vl-service";
import { QVQModelService } from "@/lib/services/qwen-qvq-service";
import { aiModelConfigService } from "@/lib/services/ai-model-config-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 视觉模型处理API
 * 支持普通视觉理解模型(VL)和推理型视觉模型(QVQ)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 解析请求数据
    const formData = await request.formData();
    const imageUrls = formData.getAll('imageUrls').map(url => url.toString());
    const prompt = formData.get('prompt')?.toString() || '';
    const systemPrompt = formData.get('systemPrompt')?.toString();
    const modelConfigId = formData.get('modelConfig')?.toString();

    // 验证输入
    if (!prompt) {
      return NextResponse.json({ error: '请提供提示词' }, { status: 400 });
    }

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: '请至少提供一张图片' }, { status: 400 });
    }

    console.log('处理图像分析请求:', {
      imageCount: imageUrls.length,
      promptLength: prompt.length,
      hasSystemPrompt: !!systemPrompt,
      providedModelId: modelConfigId
    });

    // 获取模型配置
    let modelConfig;
    if (modelConfigId) {
      modelConfig = await aiModelConfigService.getConfigById(modelConfigId);
      if (!modelConfig) {
        console.log('未找到指定模型配置，使用默认配置');
      }
    }

    // 如果没有提供特定模型或找不到指定模型，使用默认视觉模型配置
    if (!modelConfig) {
      modelConfig = await aiModelConfigService.getDefaultVisionConfig();
      
      if (!modelConfig) {
        console.log('未找到默认视觉模型配置，尝试使用默认语言模型配置');
        modelConfig = await aiModelConfigService.getDefaultConfig();
      }

      if (!modelConfig) {
        return NextResponse.json({ error: '未找到可用的AI模型配置' }, { status: 500 });
      }
    }

    console.log('使用模型配置:', {
      id: modelConfig.id,
      name: modelConfig.name,
      model: modelConfig.model
    });

    // 根据模型类型选择服务
    if (modelConfig.model.startsWith('qvq')) {
      // 使用QVQ模型服务（带思考过程）
      const qvqService = new QVQModelService();
      const response = await qvqService.analyzeImage(imageUrls, prompt, modelConfig, systemPrompt);
      // 转换为Response为NextResponse
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } else {
      // 默认使用通义千问VL服务
      const visionService = new QwenVLService();
      const response = await visionService.analyzeImages(imageUrls, prompt, modelConfig, systemPrompt);
      // 转换为Response为NextResponse
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
  } catch (error) {
    console.error('视觉API处理错误:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '处理视觉请求时发生错误' 
    }, { status: 500 });
  }
} 