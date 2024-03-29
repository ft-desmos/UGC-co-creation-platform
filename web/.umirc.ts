import { defineConfig } from '@umijs/max';

export default defineConfig({
  antd: {
    dark: true,
  },
  access: {},
  model: {},
  initialState: {},
  request: {},
  layout: {
    title: 'UGCEditor',
    locale: true,
  },
  routes: [
    {
      path: '/',
      redirect: '/stories',
    },
    {
      name: 'stories',
      path: '/stories',
      component: './stories',
    },
    {
      path: '/story',
      redirect: '/stories',
    },
    {
      path: '/story/:chainType/:storyId',
      component: './stories/story',
    },
    {
      path: '/story/:chainType/:storyId/chapter/:chapterId',
      component: './stories/story/chapter',
    },
    {
      path: '/story/:chainType/:storyId/chapter',
      redirect: '/story/:chainType/:storyId',
    },
    {
      path: '/story/:chainType/:storyId/chapter/:chapterId/edit',
      component: './stories/story/chapter/edit',
    },
    {
      name: 'writer',
      path: '/writer',
      component: './writer',
    },
    {
      redirect: '/stories',
    },
  ],
  locale: {
    default: 'en-US',
    baseSeparator: '-',
  },
  npmClient: 'yarn',
  theme: {
    'primary-color': '#d71212',
  },
  mfsu: false,
  proxy: {
  },
  history: {
    type: 'hash',
  },
  publicPath: process.env.NODE_ENV === 'development' ? '/' : './',
});
