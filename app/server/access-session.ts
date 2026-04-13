import { cookies } from "next/headers";
import {
  ACCESS_SESSION_COOKIE,
  createAccessSessionToken,
  getAccessSessionCookieOptions,
  resolveGroupBySessionToken,
} from "./access-groups";

export async function getCurrentAccessGroup() {
  const token = cookies().get(ACCESS_SESSION_COOKIE)?.value;
  return await resolveGroupBySessionToken(token);
}

export function setAccessGroupSession(groupId: string) {
  const token = createAccessSessionToken(groupId);
  cookies().set({
    ...getAccessSessionCookieOptions(),
    value: token,
  });
}

export function clearAccessGroupSession() {
  cookies().set({
    ...getAccessSessionCookieOptions(),
    value: "",
    maxAge: 0,
  });
}
