import { supabase } from './supabase';

export type ActivityAction = 'added' | 'edited' | 'completed' | 'deleted';
export type ActivityEntity = 'todo' | 'shopping_item' | 'note' | 'budget_entry';

export function logActivity(
  homeId: string,
  userId: string,
  action: ActivityAction,
  entity: ActivityEntity,
  title: string,
) {
  supabase.from('activity_log').insert({
    home_id: homeId,
    user_id: userId,
    action_type: action,
    entity_type: entity,
    entity_title: title,
  }).then(() => {});
}
