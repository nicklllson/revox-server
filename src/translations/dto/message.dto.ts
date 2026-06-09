export class MessageDto {
  type: string;
  session_id: string;
  total_duration: number;
  chunk_duration: number;
  is_vertical?: boolean | null;
}
