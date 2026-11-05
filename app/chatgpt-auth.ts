// Compatibility facade for the original Sites-specific naming.
export type { AuthenticatedUser as ChatGPTUser } from "@/lib/server/auth/current-user";
export {
  getCurrentUser as getChatGPTUser,
  requireCurrentUser as requireChatGPTUser,
  signInPath as chatGPTSignInPath,
  signOutPath as chatGPTSignOutPath,
} from "@/lib/server/auth/current-user";
