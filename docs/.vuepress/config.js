module.exports = {
  title: 'Как верстать веб-интерфейсы быстро, качественно и интересно.',
  description: 'Как верстать веб-интерфейсы быстро, качественно и интересно',
  base: '/',
  sidebarDepth: 5,
  themeConfig: {
    nav: [
      {
        text: 'VK',
        link: 'https://vk.com/levon_gambaryan',
      },
      {
        text: 'FB',
        link: 'https://www.facebook.com/gambaryan',
      }
    ],
    sidebar: [
      {
        title: `Азы`,
        collapsable: false,
        // path: '/start/',
        children: [
          {
            title: 'Препроцессор',
            path: '/start/bad',
          },
        ]
      },
    ],
  },
};
