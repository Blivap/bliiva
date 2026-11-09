import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../../common/constants/collection-names.js';

export type SupportAuditLogDocument = HydratedDocument<SupportAuditLog>;

@Schema({
  collection: SUPPORT_COLLECTIONS.auditLogs,
  timestamps: { createdAt: true, updatedAt: false },
})
export class SupportAuditLog {
  @Prop({ type: String, required: true, index: true })
  action: string;

  @Prop({ type: String, required: true, index: true })
  resourceType: string;

  @Prop({ type: SchemaTypes.ObjectId, default: null, index: true })
  resourceId: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, default: null, index: true })
  actorId: Types.ObjectId | null;

  @Prop({ type: String, default: 'system' })
  actorType: string;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadata: Record<string, unknown>;

  @Prop({ type: String, default: null })
  ipAddress: string | null;
}

export const SupportAuditLogSchema =
  SchemaFactory.createForClass(SupportAuditLog);

SupportAuditLogSchema.index({ createdAt: -1 });
SupportAuditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
