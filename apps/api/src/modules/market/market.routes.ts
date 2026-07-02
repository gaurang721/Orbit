import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { createProductSchema, updateProductSchema, type ProductDTO, type UpdateProductInput } from '@fbclone/types';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { uploadImages } from '../../middleware/upload.middleware.js';
import { prisma } from '../../lib/prisma.js';
import { publicUrl } from '../../lib/storage.js';
import { userRefSelect } from '../../lib/selects.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { errors } from '../../utils/http-error.js';
import { sendSuccess } from '../../utils/response.js';

const router: Router = Router();
router.use(requireAuth);

const productInclude = {
  images: { orderBy: { position: 'asc' } },
  category: true,
  seller: { select: userRefSelect },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function toDTO(p: ProductRow, isSaved: boolean, meId: string): ProductDTO {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    price: Number(p.price),
    currency: p.currency,
    condition: p.condition,
    status: p.status,
    location: p.location,
    images: p.images.map((m) => m.url),
    category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
    seller: p.seller,
    isSaved,
    isOwn: p.sellerId === meId,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get('/categories', asyncHandler(async (_req: Request, res: Response) => {
  const categories = await prisma.productCategory.findMany({ orderBy: { name: 'asc' } });
  sendSuccess(res, { categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })) });
}));

router.get('/products', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const q = (req.query.q as string | undefined)?.trim();
  const categorySlug = req.query.category as string | undefined;
  const products = await prisma.product.findMany({
    where: {
      status: 'AVAILABLE',
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    include: productInclude,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const saved = await prisma.savedProduct.findMany({ where: { userId: me, productId: { in: products.map((p) => p.id) } } });
  const savedSet = new Set(saved.map((s) => s.productId));
  sendSuccess(res, { products: products.map((p) => toDTO(p, savedSet.has(p.id), me)) });
}));

router.get('/saved', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const rows = await prisma.savedProduct.findMany({
    where: { userId: me },
    include: { product: { include: productInclude } },
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, { products: rows.map((r) => toDTO(r.product, true, me)) });
}));

router.post('/products', uploadImages, validate(createProductSchema), asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const b = req.body as { title: string; description: string; price: number; currency: string; condition: ProductDTO['condition']; categoryId?: string; location?: string };
  const product = await prisma.product.create({
    data: {
      sellerId: me,
      title: b.title,
      description: b.description ?? '',
      price: b.price,
      currency: b.currency,
      condition: b.condition,
      location: b.location,
      ...(b.categoryId ? { categoryId: b.categoryId } : {}),
      images: { create: files.map((f, i) => ({ uploaderId: me, type: 'IMAGE', url: publicUrl(f.filename), mimeType: f.mimetype, size: f.size, position: i })) },
    },
    include: productInclude,
  });
  sendSuccess(res, { product: toDTO(product, false, me) }, 201);
}));

router.get('/products/:id', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const product = await prisma.product.findUnique({ where: { id: req.params.id! }, include: productInclude });
  if (!product) throw errors.notFound('Product not found');
  const isSaved = (await prisma.savedProduct.count({ where: { userId: me, productId: product.id } })) > 0;
  sendSuccess(res, { product: toDTO(product, isSaved, me) });
}));

/** Edit a listing, incl. marking it SOLD/AVAILABLE (seller only). */
router.patch('/products/:id', validate(updateProductSchema), asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const existing = await prisma.product.findUnique({ where: { id: req.params.id! }, select: { sellerId: true } });
  if (!existing) throw errors.notFound('Product not found');
  if (existing.sellerId !== me) throw errors.forbidden('Only the seller can edit this listing');
  const b = req.body as UpdateProductInput;
  const product = await prisma.product.update({
    where: { id: req.params.id! },
    data: {
      ...(b.title !== undefined ? { title: b.title } : {}),
      ...(b.description !== undefined ? { description: b.description } : {}),
      ...(b.price !== undefined ? { price: b.price } : {}),
      ...(b.currency !== undefined ? { currency: b.currency } : {}),
      ...(b.condition !== undefined ? { condition: b.condition } : {}),
      ...(b.location !== undefined ? { location: b.location } : {}),
      ...(b.status !== undefined ? { status: b.status } : {}),
      ...(b.categoryId !== undefined ? { categoryId: b.categoryId } : {}),
    },
    include: productInclude,
  });
  const isSaved = (await prisma.savedProduct.count({ where: { userId: me, productId: product.id } })) > 0;
  sendSuccess(res, { product: toDTO(product, isSaved, me) });
}));

/** Delete a listing (seller only). */
router.delete('/products/:id', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const existing = await prisma.product.findUnique({ where: { id: req.params.id! }, select: { sellerId: true } });
  if (!existing) throw errors.notFound('Product not found');
  if (existing.sellerId !== me) throw errors.forbidden('Only the seller can delete this listing');
  await prisma.product.delete({ where: { id: req.params.id! } });
  sendSuccess(res, { ok: true });
}));

router.post('/products/:id/save', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  await prisma.savedProduct.upsert({
    where: { userId_productId: { userId: me, productId: req.params.id! } },
    create: { userId: me, productId: req.params.id! },
    update: {},
  });
  sendSuccess(res, { saved: true });
}));

router.post('/products/:id/unsave', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  await prisma.savedProduct.deleteMany({ where: { userId: me, productId: req.params.id! } });
  sendSuccess(res, { saved: false });
}));

export const marketRouter = router;
