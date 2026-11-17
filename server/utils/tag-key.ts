// Last.fm tags are user-entered, so "J-Pop", "j pop" and "JPop" are one genre
export const tagKey = (tag: string) => tag.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
