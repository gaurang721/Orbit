import type { NotificationType } from './enums';
import type { UserRef } from './user';

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  actor: UserRef | null;
  message: string | null;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}
