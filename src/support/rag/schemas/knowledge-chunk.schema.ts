import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../../common/constants/collection-names.js';

export type SupportKnowledgeChunkDocument =
  HydratedDocument<SupportKnowledgeChunk>;

@Schema({
  collection: SUPPORT_COLLECTIONS.knowledgeChunks,
  timestamps: true,
})
export class SupportKnowledgeChunk {
  @Prop({ type: String, required: true, index: true })
  documentId: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true, index: true })
  category: string;

  @Prop({ type: String, default: 'en' })
  language: string;

  @Prop({ type: Number, required: true })
  version: number;

  @Prop({ type: String, required: true, index: true })
  status: 'published' | 'archived';

  @Prop({ type: Number, required: true })
  chunkIndex: number;

  @Prop({ type: String, required: true })
  content: string;

  @Prop({ type: [Number], default: [] })
  embedding: number[];

  @Prop({ type: String, required: true, index: true })
  embeddingModel: string;

  @Prop({ type: Number, required: true })
  embeddingDimensions: number;

  @Prop({ type: String, required: true })
  contentHash: string;

  @Prop({ type: String, required: true })
  source: 'knowledge' | 'submission';
}

export const SupportKnowledgeChunkSchema = SchemaFactory.createForClass(
  SupportKnowledgeChunk,
);

SupportKnowledgeChunkSchema.index(
  { documentId: 1, chunkIndex: 1 },
  { unique: true },
);
SupportKnowledgeChunkSchema.index({
  status: 1,
  category: 1,
  embeddingModel: 1,
});
