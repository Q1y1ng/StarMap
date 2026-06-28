// ── 知识图谱初始化种子数据（Phase 9） ──
// 为 6 个科目初始化标准高中知识图谱树
// 运行: npx tsx prisma/seed.ts
// ─────────────────────────────────────────────

import 'dotenv/config'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const connectionString = process.env.DATABASE_URL ?? ''
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ── 树状节点定义 ──

type NodeDef = {
  name: string
  description?: string
  children?: NodeDef[]
}

const SUBJECTS: Record<string, { label: string; tree: NodeDef[] }> = {
  math: {
    label: '数学',
    tree: [
      {
        name: '函数',
        description: '函数是高中数学的核心内容，研究变量之间的依赖关系',
        children: [
          {
            name: '二次函数',
            description: '形如 y=ax²+bx+c 的函数，研究其图像、性质和最值',
            children: [
              { name: '顶点式', description: 'y=a(x-h)²+k，顶点为 (h,k)' },
              { name: '一般式', description: 'y=ax²+bx+c，对称轴 x=-b/(2a)' },
              { name: '交点式', description: 'y=a(x-x₁)(x-x₂)，x₁,x₂ 为与 x 轴交点' },
            ],
          },
          {
            name: '指数函数',
            description: '形如 y=aˣ(a>0,a≠1) 的函数，研究指数运算和函数性质',
            children: [
              { name: '指数运算', description: '指数运算法则：aᵐ·aⁿ=aᵐ⁺ⁿ，(aᵐ)ⁿ=aᵐⁿ' },
              { name: '指数函数图像', description: '过定点(0,1)，a>1 时递增，0<a<1 时递减' },
            ],
          },
          {
            name: '对数函数',
            description: '形如 y=logₐx(a>0,a≠1) 的函数，指数函数的反函数',
            children: [
              { name: '对数运算', description: '对数的运算法则及换底公式' },
              { name: '对数函数图像', description: '过定点(1,0)，a>1 时递增，0<a<1 时递减' },
            ],
          },
          {
            name: '幂函数',
            description: '形如 y=xᵃ 的函数，研究不同指数下的性质变化',
          },
          {
            name: '三角函数',
            description: '正弦、余弦、正切等周期函数的图像与性质',
            children: [
              { name: '正弦函数', description: 'y=sinx，周期 2π，值域 [-1,1]' },
              { name: '余弦函数', description: 'y=cosx，周期 2π，值域 [-1,1]' },
              { name: '正切函数', description: 'y=tanx，周期 π，定义域 x≠π/2+kπ' },
              { name: '三角恒等变换', description: '和差角公式、倍角公式、辅助角公式' },
            ],
          },
        ],
      },
      {
        name: '数列',
        description: '按一定规律排列的一列数，研究通项和求和',
        children: [
          {
            name: '等差数列',
            description: '从第二项起每项与前一项差为常数的数列',
            children: [
              { name: '等差数列通项', description: 'aₙ=a₁+(n-1)d' },
              { name: '等差数列求和', description: 'Sₙ=n(a₁+aₙ)/2 或 Sₙ=na₁+n(n-1)d/2' },
            ],
          },
          {
            name: '等比数列',
            description: '从第二项起每项与前一项比为常数的数列',
            children: [
              { name: '等比数列通项', description: 'aₙ=a₁qⁿ⁻¹' },
              { name: '等比数列求和', description: 'Sₙ=a₁(1-qⁿ)/(1-q)，q≠1' },
            ],
          },
          { name: '数列综合', description: '数列与函数、不等式的综合应用' },
          {
            name: '数学归纳法',
            description: '证明与自然数相关的命题的数学方法',
          },
        ],
      },
      {
        name: '导数',
        description: '研究函数变化率的工具，是微积分的基础',
        children: [
          { name: '导数的概念', description: '函数在某点的瞬时变化率：f\'(x₀)=lim(Δx→0) Δy/Δx' },
          { name: '求导法则', description: '基本初等函数的求导公式及四则运算法则' },
          {
            name: '单调性',
            description: '利用导数的正负判断函数的单调区间',
          },
          {
            name: '极值',
            description: '利用导数求函数的极大值和极小值',
            children: [
              { name: '极大值', description: '函数在某个局部区间内的最大值' },
              { name: '极小值', description: '函数在某个局部区间内的最小值' },
              { name: '最值问题', description: '闭区间上连续函数的最大值和最小值' },
            ],
          },
          {
            name: '导数综合应用',
            description: '导数在不等式证明、参数讨论中的应用',
          },
        ],
      },
      {
        name: '概率与统计',
        description: '研究随机现象的统计规律性',
        children: [
          {
            name: '排列组合',
            description: '分类加法计数与分步乘法计数原理',
            children: [
              { name: '排列', description: '从 n 个元素中取 m 个有序排列' },
              { name: '组合', description: '从 n 个元素中取 m 个无序组合' },
              { name: '二项式定理', description: '(a+b)ⁿ 的展开式及通项公式' },
            ],
          },
          { name: '概率', description: '随机事件的概率计算与条件概率' },
          { name: '离散型随机变量', description: '分布列、期望与方差' },
          { name: '正态分布', description: '正态分布曲线及其性质' },
        ],
      },
      {
        name: '解析几何',
        description: '用代数方法研究几何问题的分支',
        children: [
          {
            name: '直线与方程',
            description: '直线的倾斜角、斜率及多种形式的方程',
          },
          {
            name: '圆与方程',
            description: '圆的标准方程与一般方程，直线与圆的位置关系',
          },
          {
            name: '圆锥曲线',
            description: '椭圆、双曲线、抛物线的定义、方程与性质',
            children: [
              { name: '椭圆', description: '到两定点距离之和为常数的点的轨迹' },
              { name: '双曲线', description: '到两定点距离之差的绝对值为常数的点的轨迹' },
              { name: '抛物线', description: '到定点与定直线距离相等的点的轨迹' },
            ],
          },
        ],
      },
    ],
  },
  physics: {
    label: '物理',
    tree: [
      {
        name: '力学',
        description: '研究物体机械运动规律的基础物理学分支',
        children: [
          {
            name: '运动学',
            description: '描述物体运动的位移、速度、加速度等物理量',
            children: [
              { name: '匀变速直线运动', description: '加速度恒定的直线运动，三大约束公式' },
              { name: '自由落体运动', description: '只在重力作用下从静止开始的运动' },
              { name: '平抛运动', description: '水平抛出、只在重力作用下的曲线运动' },
              { name: '圆周运动', description: '物体沿圆周的运动，向心加速度 a=v²/r' },
            ],
          },
          {
            name: '牛顿运动定律',
            description: '经典力学的基石，描述力与运动的关系',
            children: [
              { name: '牛顿第一定律', description: '惯性定律：物体保持静止或匀速直线运动' },
              { name: '牛顿第二定律', description: 'F=ma，力与加速度的关系' },
              { name: '牛顿第三定律', description: '作用力与反作用力大小相等方向相反' },
            ],
          },
          {
            name: '功与能',
            description: '功、功率、动能、势能及机械能守恒',
            children: [
              { name: '功', description: 'W=F·s·cosθ，力与位移的点积' },
              { name: '动能定理', description: '合外力做功等于动能变化量' },
              { name: '机械能守恒', description: '只有重力或弹力做功时机械能守恒' },
            ],
          },
          {
            name: '动量',
            description: '动量定理与动量守恒定律',
            children: [
              { name: '动量定理', description: '合外力的冲量等于动量变化量' },
              { name: '动量守恒', description: '系统合外力为零时总动量守恒' },
              { name: '碰撞', description: '弹性碰撞与非弹性碰撞的动量能量分析' },
            ],
          },
        ],
      },
      {
        name: '电磁学',
        description: '研究电与磁现象及其相互作用的物理学分支',
        children: [
          {
            name: '静电场',
            description: '静止电荷产生的电场及其性质',
            children: [
              { name: '库仑定律', description: 'F=kq₁q₂/r²，点电荷间的静电力' },
              { name: '电场强度', description: 'E=F/q，描述电场力的性质的物理量' },
              { name: '电势与电势差', description: '描述电场能的性质的物理量' },
              { name: '电容器', description: '储存电荷的装置，C=Q/U' },
            ],
          },
          {
            name: '恒定电流',
            description: '电荷的定向移动形成的电流及其规律',
            children: [
              { name: '欧姆定律', description: 'I=U/R，部分电路与闭合电路欧姆定律' },
              { name: '电阻定律', description: 'R=ρL/S，电阻的决定因素' },
              { name: '电功率', description: 'P=UI，焦耳定律 Q=I²Rt' },
              { name: '电路分析', description: '串并联电路的特点与混联电路分析' },
            ],
          },
          {
            name: '磁场',
            description: '磁场的描述及磁场对电流的作用',
            children: [
              { name: '磁感应强度', description: 'B=F/IL，描述磁场强弱的物理量' },
              { name: '安培力', description: 'F=BILsinθ，磁场对电流的作用力' },
              { name: '洛伦兹力', description: 'f=qvBsinθ，磁场对运动电荷的作用力' },
            ],
          },
          {
            name: '电磁感应',
            description: '变化的磁场产生感应电动势的现象',
            children: [
              { name: '法拉第电磁感应定律', description: 'E=nΔΦ/Δt' },
              { name: '楞次定律', description: '感应电流的方向总是阻碍磁通量的变化' },
              { name: '自感与互感', description: '线圈自身电流变化产生的电磁感应' },
            ],
          },
        ],
      },
      {
        name: '热学',
        description: '研究热现象中物质热运动规律的分支',
        children: [
          { name: '分子动理论', description: '物质由分子构成，分子永不停息无规则运动' },
          { name: '理想气体状态方程', description: 'pV=nRT，描述气体状态参量的关系' },
          { name: '热力学定律', description: '热力学第一、第二定律及能量守恒' },
        ],
      },
      {
        name: '光学',
        description: '研究光的本质、传播规律及与物质相互作用',
        children: [
          { name: '几何光学', description: '光的直线传播、反射定律、折射定律' },
          { name: '光的干涉', description: '双缝干涉、薄膜干涉的条件与条纹特征' },
          { name: '光的衍射', description: '光绕过障碍物继续传播的现象' },
          { name: '光电效应', description: '光照射金属表面产生电子的现象' },
        ],
      },
    ],
  },
  chemistry: {
    label: '化学',
    tree: [
      {
        name: '物质结构与性质',
        description: '研究原子、分子、离子的结构及其与性质的关系',
        children: [
          {
            name: '原子结构',
            description: '原子的组成、核外电子排布规律',
            children: [
              { name: '原子核', description: '质子、中子组成，核电荷数=质子数' },
              { name: '核外电子排布', description: '分层排布，2n² 规则，最外层不超过 8' },
              { name: '元素周期表', description: '周期、族的划分及元素性质的递变规律' },
            ],
          },
          {
            name: '化学键',
            description: '原子或离子之间的强烈相互作用',
            children: [
              { name: '离子键', description: '阴、阳离子间的静电作用' },
              { name: '共价键', description: '原子间通过共用电子对形成的化学键' },
              { name: '金属键', description: '金属原子与自由电子之间的作用' },
            ],
          },
          {
            name: '分子间作用力',
            description: '分子与分子之间的相互作用',
            children: [
              { name: '范德华力', description: '分子间普遍存在的微弱作用力' },
              { name: '氢键', description: '含 H 与电负性大的原子间的特殊作用力' },
            ],
          },
        ],
      },
      {
        name: '化学反应原理',
        description: '研究化学反应的能量变化、速率和方向',
        children: [
          {
            name: '化学反应速率',
            description: '反应快慢的度量及影响因素',
            children: [
              { name: '速率影响因素', description: '浓度、温度、压强、催化剂对速率的影响' },
              { name: '活化能', description: '反应物变成活化分子所需的最低能量' },
            ],
          },
          {
            name: '化学平衡',
            description: '可逆反应达到平衡状态的条件与移动规律',
            children: [
              { name: '平衡常数', description: 'K=c(C)·c(D)/c(A)·c(B)，温度的函数' },
              { name: '勒夏特列原理', description: '平衡向削弱改变的方向移动' },
              { name: '电离平衡', description: '弱电解质的电离平衡及电离常数' },
              { name: '水解平衡', description: '盐类的水解及其规律' },
            ],
          },
          {
            name: '电化学',
            description: '化学能与电能的相互转化',
            children: [
              { name: '原电池', description: '将化学能转化为电能的装置' },
              { name: '电解池', description: '将电能转化为化学能的装置' },
              { name: '金属腐蚀', description: '电化学腐蚀的原理与防护' },
            ],
          },
        ],
      },
      {
        name: '元素化合物',
        description: '常见元素及其化合物的性质和反应',
        children: [
          { name: '碱金属', description: '钠及其化合物的性质' },
          { name: '卤素', description: '氯及其化合物的性质' },
          { name: '氧族元素', description: '硫及其化合物的性质' },
          { name: '氮族元素', description: '氮及其化合物的性质' },
          { name: '碳族元素', description: '硅及其化合物的性质' },
          { name: '过渡金属', description: '铁、铜及其化合物的性质' },
        ],
      },
      {
        name: '有机化学',
        description: '研究碳氢化合物及其衍生物的化学',
        children: [
          {
            name: '烃',
            description: '只含碳氢两种元素的有机物',
            children: [
              { name: '烷烃', description: '饱和烃，通式 CₙH₂ₙ₊₂' },
              { name: '烯烃', description: '含碳碳双键的不饱和烃' },
              { name: '炔烃', description: '含碳碳三键的不饱和烃' },
              { name: '芳香烃', description: '含苯环的烃类化合物' },
            ],
          },
          {
            name: '烃的衍生物',
            description: '烃分子中的氢被其他原子或基团取代',
            children: [
              { name: '卤代烃', description: '烃分子中的氢被卤素取代' },
              { name: '醇酚', description: '含羟基(-OH)的有机物' },
              { name: '醛', description: '含醛基(-CHO)的有机物' },
              { name: '羧酸', description: '含羧基(-COOH)的有机物' },
              { name: '酯', description: '羧酸与醇脱水形成的化合物' },
            ],
          },
          { name: '有机合成', description: '有机物的合成路线设计与分析方法' },
        ],
      },
    ],
  },
  chinese: {
    label: '语文',
    tree: [
      {
        name: '现代文阅读',
        description: '对现代文学文本的理解、分析和鉴赏',
        children: [
          {
            name: '论述类文本',
            description: '议论文、说理性文章的阅读与理解',
            children: [
              { name: '论点论据', description: '中心论点、分论点、事实论据、道理论据' },
              { name: '论证方法', description: '举例、对比、比喻、引用等论证方法' },
              { name: '逻辑分析', description: '论证结构、推理方式的逻辑分析' },
            ],
          },
          {
            name: '文学类文本',
            description: '小说、散文、戏剧等文学作品鉴赏',
            children: [
              { name: '小说阅读', description: '人物、情节、环境、主题分析' },
              { name: '散文阅读', description: '形散神聚、语言特色、情感表达' },
              { name: '叙事技巧', description: '叙述视角、叙述顺序、表现手法' },
            ],
          },
          {
            name: '实用类文本',
            description: '新闻、传记、科普文章的阅读',
            children: [
              { name: '信息筛选', description: '关键信息提取与整合' },
              { name: '图文转换', description: '图表、数据转化为文字信息' },
            ],
          },
        ],
      },
      {
        name: '古代诗文',
        description: '古代诗歌和文言文的阅读理解与鉴赏',
        children: [
          {
            name: '文言文阅读',
            description: '古代汉语文本的理解与翻译',
            children: [
              { name: '实词虚词', description: '常见文言实词、虚词的含义与用法' },
              { name: '文言句式', description: '判断句、被动句、省略句、倒装句' },
              { name: '文言翻译', description: '文言文与现代汉语的转换' },
              { name: '文言断句', description: '根据语法和语义给文言文断句' },
            ],
          },
          {
            name: '古代诗歌',
            description: '古诗词的鉴赏分析方法',
            children: [
              { name: '诗歌意象', description: '诗中意象的内涵与象征意义' },
              { name: '诗歌手法', description: '借景抒情、托物言志、典故运用' },
              { name: '诗歌风格', description: '不同诗人、不同流派的风格特点' },
              { name: '炼字赏析', description: '关键词句的表达效果赏析' },
            ],
          },
          {
            name: '名篇默写',
            description: '课内要求背诵的经典篇目的准确默写',
          },
        ],
      },
      {
        name: '语言文字运用',
        description: '汉语基础知识的应用能力',
        children: [
          { name: '成语运用', description: '常见成语的含义、用法与辨析' },
          { name: '病句修改', description: '语序不当、搭配不当、成分残缺等病句类型' },
          { name: '语言得体', description: '不同语境下的语言表达规范' },
          { name: '衔接连贯', description: '句子排序与段落衔接' },
          { name: '修辞手法', description: '比喻、拟人、排比等常见修辞的识别与运用' },
        ],
      },
      {
        name: '写作',
        description: '议论文、记叙文等文体的写作能力',
        children: [
          { name: '审题立意', description: '准确理解题目要求，确定文章中心思想' },
          { name: '结构布局', description: '文章的开头、主体、结尾的结构安排' },
          { name: '素材运用', description: '论据素材的积累、选择与运用' },
          { name: '语言表达', description: '语言的准确性、生动性和深刻性' },
        ],
      },
    ],
  },
  english: {
    label: '英语',
    tree: [
      {
        name: '语法',
        description: '英语语法体系，包括词法和句法',
        children: [
          {
            name: '时态语态',
            description: '英语动词的时态和语态变化',
            children: [
              { name: '一般时态', description: '一般现在、过去、将来时的用法' },
              { name: '进行时态', description: '现在、过去、将来进行时的用法' },
              { name: '完成时态', description: '现在、过去、将来完成时的用法' },
              { name: '被动语态', description: 'be+过去分词的被动结构及各种时态的被动' },
            ],
          },
          {
            name: '从句',
            description: '复合句中充当句子成分的从句',
            children: [
              { name: '名词性从句', description: '主语从句、宾语从句、表语从句、同位语从句' },
              { name: '定语从句', description: '关系代词和关系副词引导的定语从句' },
              { name: '状语从句', description: '时间、条件、原因、让步等状语从句' },
            ],
          },
          {
            name: '非谓语动词',
            description: '不定式、动名词、分词的形式与用法',
            children: [
              { name: '不定式', description: 'to do 的形式及在句中的功能' },
              { name: '动名词', description: 'doing 的形式及在句中的功能' },
              { name: '分词', description: '现在分词与过去分词的区别与用法' },
            ],
          },
          { name: '虚拟语气', description: '表示假设、愿望、建议等的语气形式' },
          { name: '特殊句式', description: '强调句、倒装句、省略句等特殊结构' },
        ],
      },
      {
        name: '词汇',
        description: '高中英语词汇的积累与运用',
        children: [
          { name: '词根词缀', description: '常见词根、前缀、后缀的构词规律' },
          { name: '固定搭配', description: '动词短语、介词短语等固定搭配' },
          { name: '词汇辨析', description: '近义词、形近词的辨析与运用' },
          { name: '熟词生义', description: '熟悉单词在特定语境中的特殊含义' },
        ],
      },
      {
        name: '阅读理解',
        description: '英语语篇的理解与分析能力',
        children: [
          { name: '主旨大意', description: '文章或段落的主旨和中心思想' },
          { name: '细节理解', description: '文中具体信息的定位与理解' },
          { name: '推理判断', description: '根据文本进行合理推断' },
          { name: '词义猜测', description: '根据上下文猜测生词的含义' },
          { name: '七选五', description: '语篇结构分析与句子还原' },
        ],
      },
      {
        name: '写作',
        description: '英语书面表达能力',
        children: [
          { name: '应用文写作', description: '信件、通知、邮件等应用文体' },
          { name: '续写', description: '读后续写的逻辑衔接与语言风格' },
          { name: '概要写作', description: '文章要点提炼与概括' },
          { name: '高级句式', description: '倒装、虚拟、强调等高级句型的运用' },
        ],
      },
      {
        name: '听力',
        description: '英语听力理解能力',
        children: [
          { name: '数字信息', description: '时间、价格、数量等数字信息的听辨' },
          { name: '推理理解', description: '根据对话内容推断人物关系、隐含含义' },
          { name: '主旨归纳', description: '对话或独白的主旨大意' },
        ],
      },
    ],
  },
  geography: {
    label: '地理',
    tree: [
      {
        name: '自然地理',
        description: '研究自然环境的组成、结构、特征和演变规律',
        children: [
          {
            name: '宇宙与地球',
            description: '地球在宇宙中的位置及其运动规律',
            children: [
              { name: '地球自转', description: '自转方向、周期及地理意义（昼夜交替、时差）' },
              { name: '地球公转', description: '公转轨道、周期及地理意义（四季更替、五带）' },
              { name: '太阳对地球影响', description: '太阳辐射与太阳活动对地球的影响' },
            ],
          },
          {
            name: '大气运动',
            description: '大气的组成、运动和天气气候',
            children: [
              { name: '冷热不均引起大气运动', description: '热力环流、风的形成与受力分析' },
              { name: '气压带风带', description: '全球气压带风带的分布与季节移动' },
              { name: '天气系统', description: '锋面、气旋与反气旋对天气的影响' },
              { name: '气候变化', description: '全球变暖等气候变化问题' },
            ],
          },
          {
            name: '水循环',
            description: '自然界的水循环及其地理意义',
            children: [
              { name: '水循环类型', description: '海陆间循环、陆地内循环、海上内循环' },
              { name: '河流补给', description: '降水、冰雪融水、地下水等补给方式' },
              { name: '洋流', description: '洋流的分布规律及其对地理环境的影响' },
            ],
          },
          {
            name: '地表形态',
            description: '地壳物质循环与地表形态的塑造',
            children: [
              { name: '内力作用', description: '地壳运动、岩浆活动、变质作用' },
              { name: '外力作用', description: '风化、侵蚀、搬运、堆积' },
              { name: '岩石圈物质循环', description: '三大类岩石的相互转化' },
            ],
          },
          {
            name: '自然地理环境整体性',
            description: '自然地理各要素的相互作用与整体性',
          },
        ],
      },
      {
        name: '人文地理',
        description: '研究人类活动与地理环境的关系',
        children: [
          {
            name: '人口',
            description: '人口增长模式与人口迁移',
            children: [
              { name: '人口增长', description: '原始型、传统型、现代型人口增长模式' },
              { name: '人口迁移', description: '人口迁移的原因、特点与影响' },
              { name: '人口容量', description: '环境承载力与合理人口容量' },
            ],
          },
          {
            name: '聚落与城市',
            description: '城市空间结构与城市化进程',
            children: [
              { name: '城市空间结构', description: '商业、住宅、工业区的合理布局' },
              { name: '城市化', description: '城市化的进程、特点与问题' },
              { name: '地域文化', description: '地域文化对建筑、聚落的影响' },
            ],
          },
          {
            name: '农业',
            description: '农业地域类型与农业区位因素',
            children: [
              { name: '农业区位', description: '自然条件与社会经济条件对农业的影响' },
              { name: '主要农业地域类型', description: '季风水田、商品谷物、大牧场放牧等' },
            ],
          },
          {
            name: '工业',
            description: '工业区位因素与工业地域',
            children: [
              { name: '工业区位因素', description: '原料、动力、劳动力、市场、技术等' },
              { name: '工业地域', description: '工业集聚与工业分散的优劣分析' },
            ],
          },
          {
            name: '交通运输',
            description: '交通运输方式与布局对区域发展的影响',
          },
        ],
      },
      {
        name: '区域地理',
        description: '世界和中国主要区域的特征与可持续发展',
        children: [
          { name: '世界地理', description: '主要国家和地区的地理特征' },
          { name: '中国地理', description: '中国自然地理与人文地理特征' },
          { name: '区域发展', description: '区域生态建设、资源开发与产业转移' },
          {
            name: '地理信息技术',
            description: '遥感(RS)、全球定位系统(GPS)、地理信息系统(GIS)',
          },
        ],
      },
    ],
  },
}

// ── 跨学科关联边 ──

type EdgeDef = {
  source: string  // 格式 "subject:name"
  target: string  // 格式 "subject:name"
  type: 'prerequisite' | 'related'
}

const EDGES: EdgeDef[] = [
  // 数学内部关联
  { source: '数学:二次函数', target: '数学:导数', type: 'prerequisite' },
  { source: '数学:三角函数', target: '数学:导数', type: 'prerequisite' },
  { source: '数学:数列', target: '数学:导数', type: 'related' },
  { source: '数学:指数函数', target: '数学:对数函数', type: 'related' },
  // 物理先修要求
  { source: '数学:三角函数', target: '物理:运动学', type: 'prerequisite' },
  { source: '数学:导数', target: '物理:运动学', type: 'prerequisite' },
  { source: '数学:三角函数', target: '物理:圆周运动', type: 'prerequisite' },
  { source: '物理:运动学', target: '物理:牛顿运动定律', type: 'prerequisite' },
  { source: '物理:牛顿运动定律', target: '物理:功与能', type: 'prerequisite' },
  { source: '物理:牛顿运动定律', target: '物理:动量', type: 'prerequisite' },
  { source: '物理:功与能', target: '物理:电磁学', type: 'prerequisite' },
  { source: '物理:静电场', target: '物理:恒定电流', type: 'prerequisite' },
  { source: '物理:恒定电流', target: '物理:磁场', type: 'prerequisite' },
  { source: '物理:磁场', target: '物理:电磁感应', type: 'prerequisite' },
  // 化学先修要求
  { source: '化学:原子结构', target: '化学:化学键', type: 'prerequisite' },
  { source: '化学:化学键', target: '化学:分子间作用力', type: 'prerequisite' },
  { source: '化学:化学反应速率', target: '化学:化学平衡', type: 'prerequisite' },
  { source: '化学:化学平衡', target: '化学:电化学', type: 'prerequisite' },
  // 数学与化学
  { source: '数学:函数', target: '化学:化学反应速率', type: 'related' },
  // 物理与化学
  { source: '物理:电磁学', target: '化学:电化学', type: 'related' },
  // 语文与英语
  { source: '语文:现代文阅读', target: '英语:阅读理解', type: 'related' },
  { source: '语文:写作', target: '英语:写作', type: 'related' },
  // 地理与物理
  { source: '物理:热学', target: '地理:大气运动', type: 'related' },
  { source: '物理:力学', target: '地理:地球自转', type: 'related' },
  // 化学与地理
  { source: '化学:元素化合物', target: '地理:岩石圈物质循环', type: 'related' },
]

// ── 节点 ID 缓存 ──

const nodeIdMap = new Map<string, string>() // "subject:name" => uuid

// ═══════════════════ Seed ═══════════════════

async function createNode(subject: string, def: NodeDef, parentId: string | null, level: number) {
  const key = `${subject}:${def.name}`

  const node = await prisma.knowledgeNode.upsert({
    where: { subject_name: { subject, name: def.name } },
    update: {
      parentId,
      level,
      description: def.description ?? null,
    },
    create: {
      subject,
      name: def.name,
      parentId,
      level,
      description: def.description ?? null,
    },
  })

  nodeIdMap.set(key, node.id)

  // 递归创建子节点
  if (def.children && def.children.length > 0) {
    for (const child of def.children) {
      await createNode(subject, child, node.id, level + 1)
    }
  }
}

async function createEdges(edges: EdgeDef[]) {
  for (const edge of edges) {
    const sourceId = nodeIdMap.get(edge.source)
    const targetId = nodeIdMap.get(edge.target)

    if (!sourceId) {
      console.warn(`  ⚠️ 未找到源节点: ${edge.source}`)
      continue
    }
    if (!targetId) {
      console.warn(`  ⚠️ 未找到目标节点: ${edge.target}`)
      continue
    }

    await prisma.knowledgeEdge.upsert({
      where: {
        sourceId_targetId_relationType: {
          sourceId,
          targetId,
          relationType: edge.type,
        },
      },
      update: {},
      create: {
        sourceId,
        targetId,
        relationType: edge.type,
      },
    })
  }
}

// ═══════════════════ Main ═══════════════════

async function main() {
  console.log('🌱 开始初始化知识图谱数据...\n')

  // 清空旧数据（先删边再删节点）
  await prisma.knowledgeEdge.deleteMany()
  await prisma.knowledgeNode.deleteMany()
  console.log('  ✅ 已清空旧数据\n')

  // 创建各科目知识树
  for (const [, subject] of Object.entries(SUBJECTS)) {
    console.log(`  📚 初始化 ${subject.label} 知识树...`)
    for (const rootNode of subject.tree) {
      await createNode(subject.label, rootNode, null, 0)
    }
    console.log(`     → ${subject.label} 完成`)
  }

  console.log('\n  🔗 创建知识关联边...')
  await createEdges(EDGES)
  console.log(`     → ${EDGES.length} 条关联边创建完成`)

  // 统计
  const nodeCount = await prisma.knowledgeNode.count()
  const edgeCount = await prisma.knowledgeEdge.count()
  console.log(`\n  📊 知识图谱统计:`)
  console.log(`     - 知识点节点: ${nodeCount} 个`)
  console.log(`     - 关联关系:   ${edgeCount} 条`)
  console.log(`     - 科目数量:   ${Object.keys(SUBJECTS).length} 科`)
  console.log('\n✅ 知识图谱初始化完成!')
}

main()
  .catch((e) => {
    console.error('❌ 种子脚本执行失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
