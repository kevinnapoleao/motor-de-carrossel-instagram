import assert from 'node:assert/strict';
import { buildPostizScheduleBody, getBasePlatform, isSupportedIntegration } from './socialEngine.js';
import type { PostizIntegration } from './socialEngine.js';

const scheduleAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const media = [{ id: 'media-1', path: 'https://uploads.postiz.com/slide.png' }, { id: 'media-2', path: 'https://uploads.postiz.com/slide-2.png' }];
const channel = (identifier: PostizIntegration['identifier']): PostizIntegration => ({
  id: `account-${identifier}`, name: 'Perfil de teste', identifier, profile: '@teste', disabled: false
});

const instagram = buildPostizScheduleBody({ channel: channel('instagram'), caption: 'Legenda revisada', scheduledTime: scheduleAt, media });
assert.equal(instagram.type, 'schedule');
assert.equal(instagram.posts[0].integration.id, 'account-instagram');
assert.equal(instagram.posts[0].value[0].image.length, 2);
assert.equal(instagram.posts[0].settings.__type, 'instagram');

const linkedin = buildPostizScheduleBody({ channel: channel('linkedin-page'), caption: 'Texto revisado', scheduledTime: scheduleAt, media });
assert.equal(linkedin.posts[0].settings.__type, 'linkedin-page');
assert.equal(linkedin.posts[0].settings.post_as_images_carousel, true);

const threads = buildPostizScheduleBody({ channel: channel('threads'), caption: 'Texto revisado', scheduledTime: scheduleAt, media: media.slice(0, 1) });
assert.equal(threads.posts[0].settings.__type, 'threads');

const tiktok = buildPostizScheduleBody({
  channel: channel('tiktok'), caption: 'Vídeo revisado', scheduledTime: scheduleAt,
  media: [{ id: 'video-1', path: 'https://uploads.postiz.com/reel.mp4' }],
  options: { tiktokPrivacy: 'SELF_ONLY', tiktokBrandContent: true, tiktokBrandOrganic: false, videoMadeWithAI: true }
});
assert.equal(tiktok.posts[0].settings.__type, 'tiktok');
assert.equal(tiktok.posts[0].settings.privacy_level, 'SELF_ONLY');
assert.equal(tiktok.posts[0].settings.brand_content_toggle, true);
assert.equal(tiktok.posts[0].settings.brand_organic_toggle, false);
assert.equal(tiktok.posts[0].settings.video_made_with_ai, true);
assert.equal(tiktok.posts[0].settings.content_posting_method, 'DIRECT_POST');

const youtube = buildPostizScheduleBody({
  channel: channel('youtube'), caption: 'Descrição revisada', scheduledTime: scheduleAt,
  media: [{ id: 'video-1', path: 'https://uploads.postiz.com/reel.mp4' }],
  options: { youtubeTitle: 'Título do vídeo', youtubeVisibility: 'unlisted', youtubeMadeForKids: 'no' }
});
assert.equal(youtube.posts[0].settings.__type, 'youtube');
assert.equal(youtube.posts[0].settings.title, 'Título do vídeo');
assert.equal(youtube.posts[0].settings.type, 'unlisted');
assert.equal(youtube.posts[0].settings.selfDeclaredMadeForKids, 'no');

assert.equal(getBasePlatform('instagram-standalone'), 'instagram');
assert.equal(getBasePlatform('linkedin-page'), 'linkedin');
assert.equal(isSupportedIntegration(channel('threads')), true);
assert.throws(() => buildPostizScheduleBody({
  channel: { ...channel('threads'), identifier: 'facebook' as PostizIntegration['identifier'] },
  caption: 'Teste', scheduledTime: scheduleAt, media: []
}), /não é compatível/);
assert.throws(() => buildPostizScheduleBody({
  channel: channel('threads'), caption: 'Teste', scheduledTime: new Date(Date.now() - 1000).toISOString(), media: []
}), /horário futuro/);

console.log('Postiz adapter tests passed (payload validation only; no network requests were made).');
