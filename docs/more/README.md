# Препроцессор, JavaScript и фреймворки

Ого, вы еще читаете?!.. Отлично!

Во второй части пособия идеи и подходы станут менее скандальными, так как мы просто разберем несколько жизненных и углубленных кейсов современного экранного дизайна. И если, поначалу, темы будут еще наглядно применять мощный и гибкий, но «достаточно спорный» подход к препроцессору, описанный в первой части трактата, то дальше речь пойдет уже сугубо об использовании javascript для GUI и доступности в контексте популярных реактивных фреймворков.

## Темизация

Очень часто встречающимся кейсом является темизация. Ваш заказчик вполне может захотеть чтобы светлый интерфейс продукта _ночью глаза клиентам не резал_. А вы _уже все сверстали_, пичалька...

Справедливости ради, нужно упомянуть что ссылка на пример с [темизацией на Styled Components с React и TypeScript](https://github.com/ushliypakostnik/react-auth/tree/master/src/theme) уже встречалась в тексте в самом конце рассказа о препроцессоре, когда разговор зашел о компонентности и несвязности, плюс это один из немногих кейсов, в котором использование просто самих Custom Properties кажется вполне эффективным. Готовые модули часто стали применять такой подход к кастомизации. Ну это явно получше чем тонна невменяемого CSS. О действительно уникальном кейсе когда «нативные переменные» оказываются единственным изящным выходом из сложной ситуации будет рассказано немного ниже. 

Давайте запилим все на [Vue c SCSS](https://github.com/ushliypakostnik/vue-scss-i18next/tree/master/src). Надеюсь что вы все поняли из первой части, и в вашем проекте все цвета дотошно абстрагированы в переменных стилевой базы. Иначе, конечно, _ничего не получится_.

Что мы должны добавить в проект в самую первую очередь? Как в случае стилей, это, по моему убеждению, должны быть глобальные переменные препроцессора, **для javascript нужно первым делом определить константы** которые будет использовать вся остальная система. Так как информацию о том, какую тему последний раз выбрал пользователь мы планируем хранить в LocalStorage браузера (вы можете также использовать технологию cookies или sessionStorage, в зависимости от ситуации), нужно создать поле для этого, а также определить сами темы - мы собираемся сделать дневную и ночную. В <code>@/src/utils/constants.js</code>:

```javascript
// В @/src/utils/contstans.js:

export const LOCALSTORAGE = {
  THEME: 'theme',
};

export const THEMES = [
  { id: 1, name: 'light' },
  { id: 2, name: 'dark' },
];

// Auto theme
const theme = localStorage.getItem(LOCALSTORAGE.THEME) || null;
export const AUTO_THEME = theme || THEMES[1].name;
```

Если в локальном хранилище нет записи о выбранной теме - выставляем ночную по дефолту.

Следующей вещью которая действительно важна в реактивном приложении является его стор. Несмотря на то, что тема оформления никак не касается данных и бизнес-логики, и знать о ней, предположительно, будут только два компонента: модуль переключения и какая-то верхняя обертка, которой мы будем выставлять модификатор для верстки, мы все равно планируем организовать это общение через иммутабельный стор. Выделим в нем модуль который будет обслуживать различные функциональности для GUI, добавим стору в <code>@/src/store/index.js</code>:  

```javascript
// В @/src/store/index.js:
/* eslint-disable import/no-cycle */
import Vue from 'vue';
import Vuex from 'vuex';

import utils from './modules/utils';

Vue.use(Vuex);

const debug = process.env.NODE_ENV !== 'production';

export default new Vuex.Store({
  modules: {
    utils,
  },
  strict: debug,
});
```

И собственно сам модуль в в <code>@/src/store/modules/utils.js</code>:
```javascript
// В @/src/store/modules/utils.js:
/* eslint-disable import/no-cycle, no-shadow */
import {
  LOCALSTORAGE,
  AUTO_THEME,
} from '@/utils/constants';
import storage from '@/utils/storage';

const initialState = {
  theme: AUTO_THEME,
};

const state = initialState;

const getters = {
  theme: state => state.theme,
};

const actions = {
  changeTheme: ({ commit }, theme) => {
    commit('changeTheme', theme);
    localStorage.setItem(LOCALSTORAGE.THEME, theme);
  },
};

const mutations = {
  changeTheme: (state, theme) => {
    state.theme = theme;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
```

Вся внутренняя кухня для того чтобы менять тему готова и можно перейти к разметке. Так как цвета нужно менять даже для самой верхней обертки в GUI, класс модификатор распространяющий изменения по верстке мы будем выставлять «прямо на всем приложении», в главном шаблоне <code>@/src/App.vue</code> который использует <code>\<router-view /></code> роутера - точку в которой будут монтироваться остальные компоненты, и основной файл <code>@/src/scss/_main.scss</code> собирающий стили. Подписываем этот компонент на геттер нужного поля стора:
```vue
<!-- В @/src/App.vue: -->
<template>
  <div
    id="app"
    :class="`app--${theme}`"
  >
    <router-view />
  </div>
</template>

<script>
import { createNamespacedHelpers } from 'vuex';

const { mapGetters } = createNamespacedHelpers('utils');

export default {
  name: 'App',

  computed: {
    ...mapGetters({
      theme: 'theme',
    }),
  },
};
</script>

<style src="./styles/_main.scss" lang="scss">
  #app {
    min-height: 100vh;
  }
</style>
```

Пилим компонент переключателя, который должен уметь отправлять действие в стор:
```vue
<!-- В @/src/components/Elements/ThemeSwitch.vue: -->
<template>
  <ul class="switch">
    <li
      v-for="value in themes"
      v-bind:key="value"
    >
      <a v-if="value !== theme"
        href="#"
        @click.prevent="changeTheme(value)"
      >{{ value }}</a>
      <span v-else>{{ value }}</span>
    </li>
  </ul>
</template>

<script>
import { createNamespacedHelpers } from 'vuex';

import { THEMES } from '@/utils/constants';

const { mapGetters } = createNamespacedHelpers('utils');

export default {
  name: 'ThemeSwitch',

  computed: {
    ...mapGetters({
      theme: 'theme',
    }),

    themes() {
      const themes = THEMES.map((theme) => {
        return theme.name;
      });
      return themes;
    },
  },

  methods: {
    changeTheme(theme) {
      this.$store.dispatch('utils/changeTheme', theme);
    },
  },
};
</script>
```

Теперь нам нужен препроцессор который будет уметь вести себя «как хамелеон» и «спускать через переменные» правильную кастомизацию всему заинтересованному в этом оформлению, разметке. Добавим в препроцессор отдельную папку для темизации <code>@/src/scss/themes/</code>, подключим файлы из нее в главном:

```
.
└─ src
   └─ sscs
      └─ themes
      │  ├─ _theme--dark.scss
      │  ├─ _theme--light.scss
      │  └─ _themes__content.scss
      └─ ...
```

```scss
// В @/src/scss/_main.scss: 
// App themes
@import "./themes/_themes__content";
@import "./themes/_theme--dark";
@import "./themes/_theme--light";
```

Ну и делаем все дерзко и изящно:

```scss
// В @/src/scss/themes/_theme--dark.scss: 
// App dark theme
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

%theme--dark {
  $colors__background: #263340 !global;
  $colors__border: #131920 !global;
  ...
}

.app {
  &--dark {
    @extend %theme--dark !optional;

    @include themes__content;
  }
}
```

```scss
// В @/src/scss/themes/_theme--light.scss: 
// App light theme
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

%theme--light {
  $colors__background: #fafafa !global;
  $colors__border: #c6dde5 !global;
  ...
}

.app {
  &--light {
    @extend %theme--light !optional;

    @include themes__content;
  }
}
```

```scss
// В @/src/scss/themes/_themes__content.scss: 
// App themes
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

@mixin themes__content {
  // Base

  input {
    border: 1px solid $colors__border;
  }

  // Main selectors

  .layout {
    background: $colors__background;
  }

  .header {
    background: $colors__background;
    border-bottom: 1px solid $colors__border;
  }

  .switch {
    background: $colors__card;
    border: 1px solid $colors__border;
  }
}
```

Пример только кажется сложным. Мы формируем два абстрактных контекста в которых создаются правильные наборы переменных для каждой из тем. Для того чтобы переменные «всплыли» и стали видны глобально используем метку Sass <code>**!global**</code> ([переменные в Sass](https://sass-scss.ru/documentation/sassscript/peremennie/), посмотрите еще про [**!default**](https://sass-scss.ru/documentation/sassscript/peremennie_po-umolchaniyu/)). Для того чтобы примешивание «пустого» плейсхолдера только с переменными в модификатор не выдавало ошибки компиляции - указываем метку <code>**!optional**</code> [в доке](https://sass-scss.ru/documentation/pravila_i_direktivi/metka_neobyazatelnosti_optional/).

Мы используем общую для обоих тем «примесь-хамелеон», которая, компилируясь в нужном контексте, раздает правильный набор значений только той части разметки, которой необходима темизация. Тут мы как раз используем наше супермощное абстрактное связывание. Если что-то меняет оформление в зависимости от темы - связываем по селектору с модификатором темы. Мы делаем только одно отступление от уже озвученной в первой части пособия методы - несмотря на то, что это явно паттерн «воздействующий повсеместно на компоненты-виджеты-элементы через модификатор внешней обертки» - добавляем темизируемое оформление в общей примеси для модификаторов, а не в компонентах и виджетах. Потому, кажется, что тут просто так удобнее. С другой стороны, легко можно представить, как точно тоже самое можно сделать и «дисперсно-компонентно», размечая специфические стилизации для каждого компонента или виджета-элемента в его композиции. Как вам удобнее.

Такой подход способен сделать темизацию вашего интерфейса легким и приятным занятием. Код препроцессора не повторяется и остается максимально выразительным. Этот шикарный кейс еще раз подчеркивает что возможности глобальной абстракции стилей препроцессором оказываются крайне эффективны именно в грамотной связке с актуальными компонентными подходами. Каждый занимается своим делом. **Компонентный реактивный фреймворк обслуживает функциональность, тогда как препроцессор занимается оформлением.**

## Константы и утилитарные модули

### Константы уровня приложения

Итак - начнем с констант. Любой компонентный интерфейс в своей разметке все равно вынужден четко передавать графический прототип, макеты или быть синхронным со стилями по скорости анимаций, например. Это очевидно говорит о том что система должна использовать некий изначально поставленный объект со значениями:

```javascript
// В @/src/utils/contstans.js:
export const DESIGN = {
  // Адаптивные брекпоинты:
  BREAKPOINTS: {
    tablet: 768,
    desktop: 1240,
  },
  // Типоразмеры:
  DEVICES_TYPES: [
    'desktop',
    'tablet',
    'mobile',
  ],
  TIMEOUT: 200, // Скорость стандартной анимации
  // Конфигурация-перечень видов роутера:
  VIEWS: [
    { id: 1, name: 'main', path: '/main', },
    { id: 2, name: 'view2', path: '/view2', },
    { id: 3, name: 'view3', path: '/view3', },
  ], 
  // Модификаторы вида отдельного компонента, контексты использования:
  COMPONENT_VIEWS: ['view1', 'view2'],
  // Классы-модификаторы для деградации:
  OS_CLASS: '--ios',
  OS_8_CLASS: '--ios--8',
  IE_CLASS: '--ie',
};
```

Это _все та же песня_ про необходимость унификации и стандартизации, соглашений особенно при работе командой. То были _какие-то_ стили, а тут речь идет уже, _на минуточку_, о языке программирования. Перестаньте писать разметку и компоненты, добавлять им функциональность основываясь на раскиданных по всему проекту магических числах и строках, локальных утилитарных и дублирующихся глобально частных функциях. Вы не должны напрягаться и судорожно искать где и что находится или происходит, в одном месте поправил, _в другом отломалось_. **Предоставьте все глобально: основную конфигурацию, абстракции дизайн-макета, требуемого поведения оформления и основанные на них переиспользуемые утилитарные модули-функции.**

Прежде всего для адаптивности нам нужны <code>DESIGN.BREAKPOINTS</code> - очень важно: **точно такие же как в препроцессоре**. При использовании описанной методы - нет возможности сделать это «один раз» - сразу и для js и для препроцессора. Или, например, конфигурация основных видов для роутера <code>DESIGN.VIEWS</code> - возможно даже будет просто более-менее соответствовать количеству макетов проекта.

### Константы уровня компонента

Кейсов в которых удобно вводить константы на уровне компонента также много, но они достаточно частные. Поэтому я покажу только один важный кейс, который напрямую связан с озвученными выше подходами к разметке и композиции селекторов. Вспомним наш самый распространенный паттерн «рядовое переиспользование модуля в отдельном конкретном виде». Посмотрим как это будет на React. 

Используем простейшие прототипы на функциях, модуль [classnames](https://www.npmjs.com/package/classnames) и [Шаблонные строки](https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/template_strings):

Компонент:
```jsx harmony
// В @/src/components/SomeComponent.jsx:
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import '../../scss/components/_component.scss';

const SomeComponent = ({ view }) => {
  const COMPONENT_CLASS = 'component';
  
  const componentClasses = classNames(
    `${COMPONENT_CLASS}`,
    `${COMPONENT_CLASS}--${view}`,
  );

  return (
    <div className={componentClasses}>
       <div className={`${COMPONENT_CLASS}__element1`} />
       <div className={`${COMPONENT_CLASS}__element2`} />
    </div>
  );
};

SomeComponent.propTypes = {
  view: PropTypes.string.isRequired,
};

export default SomeComponent;
```

Некая **вьюха** которая его переиспользует:
```jsx harmony
// В @/src/components/views/View.jsx:
import React from 'react';

import { DESIGN } from '../../store/constants';

import SomeComponent from '../../components/component';

import '../../scss/views/_view.scss';

const View = () => {
  const VIEW_CLASS = 'view';

  return (
    <div
      id={`${VIEW_CLASS}`}
      className={`${VIEW_CLASS}`}
    >
      <div class={`${VIEW_CLASS}__component-wrapper`}>
        <SomeComponent view={DESIGN.COMPONENT_VIEWS[1]} />
      </div>
    </div>
  );
};

export default View;
```

Понятно, что в результирующей разметке мы увидим:
```html
<div id="view" class="view">
  <div class="view__component-wrapper">
    <div class="component component--view1">
      <div class="component__element1"></div>
      <div class="component__element2"></div>
    </div>
  </div>
</div>
```

Ну и полный простор для композиций препроцессора:

```scss
// В @/src/scss/components/_component.scss: 
.component {
  &__element1 { ... }
  
  &__element2 { ... }

  &--view1 { ... }
}

// В @/src/scss/views/_view.scss: 
#view,
.view {
  // Обертка над переиспользуемым компонентом
  &__component-wrapper { ... }

  // Абстрактное связывание
  .component { ... }
}
```

Для разметки конкретных конечных видов, вьюх, кажется вполне оправданным использовать уникальные идентификаторы - по спецификации - то, что точно присутствует на странице в единственном экземпляре.

### Утилитарные модули

В даже минимально сложных разветвленных проектах между конфигурацией и логикой в компонентах удобно сформировать еще один слой утилитарных переиспользуемых модулей со стандартной функциональностью. Это например функции-валидадоты, модуль стандартизирующий взаимодействие по API, модуль организующий работу с браузерным хранилищем, конфигурация переводчика. Очень полезно выделить в отдельный модуль все функции которые нужны для взаимодействия с экраном и GUI - ведь одних только значений брекпоинтов и скорости анимации в константах явно недостаточно - нужно еще и нечто способное разнообразно и эффективно с этим работать, и чему вы сможете добавлять функционал по необходимости - в <code>@/src/utils/screen-helper.js</code>: 

```javascript
// В @/src/utils/screen-helper.js:
import { DESIGN } from '@/utils/constants';

// Модуль экранный помощник
const ScreenHelper = (() => {
  /* eslint-disable no-unused-vars */
  const NAME = 'ScreenHelper';

  // Брекпоинты и типоразмеры.
  // Конфигурируем "ручками" глобальные качества обслуживаемого дизайна:
  // нам неободимо выразить брекпоинты
  // через типоразмеры-сравнения с window.matchMedia().
  // Можно добавлять точки и диапазоны с ними по необходимости,
  // но стандартно и утилитарно для всего интерфейса:

  const TABLET = DESIGN.BREAKPOINTS.tablet;
  const DESKTOP = DESIGN.BREAKPOINTS.desktop;

  const isMobile = () => {
    return window.matchMedia(`(max-width: ${TABLET - 1}px)`).matches;
  };

  const isTablet = () => {
    return window.matchMedia(`(min-width: ${TABLET}px) and (max-width: ${DESKTOP - 1}px)`).matches;
  };

  const isDesktop = () => {
    return window.matchMedia(`(min-width: ${DESKTOP}px)`).matches;
  };

  // Еще полезные методы для адаптивности, доступности и работы с экраном:

  const getOrientation = () => {
    if (window.matchMedia('(orientation: portrait)').matches) {
      return 'portrait';
    } return 'landscape';
  };

  const getPixelRatio = () => {
    return window.devicePixelRatio
           || window.screen.deviceXDPI / window.screen.logicalXDPI;
  };

  // У большинства декстопных браузеров ненулевая ширина непрозрачного скроллбара 
  const getScrollbarWidth = () => {
    const { body } = document;
    const bw1 = body.clientWidth;
    body.style.overflow = 'hidden';
    const bw2 = body.clientWidth;
    body.style.overflow = '';
    return bw2 - bw1;
  };

  return {
    TABLET,
    DESKTOP,
    isMobile,
    isTablet,
    isDesktop,
    getOrientation,
    getPixelRatio,
    getScrollbarWidth,
  };
})();

export default ScreenHelper;
```

Обратите внимание: десктопные браузеры имеют разную ширину основного скроллбара - от нулевой прозрачной, до, возможно, даже некой специфической, кастомизированной через CSS для webkit. Поэтому если вашему javascript потребуется сравнить значение <code>document.documentElement.clientWidth</code> со специфическим нестандартным брекпоинтом которого нет в константах, и, следовательно, который не представлен в адаптивных функциях-сравнениях через <code>window.matchMedia()</code> в <code>ScreenHelper</code> - случай очень частный, исключительный и вы не хотите добавлять точку ради одного «фикса» - скрипт будет ошибаться на ненулевую ширину в части просмотрщиков. В таких случаях необходимо использовать уточняющую логику:

```javascript
// Специфический брекпоинт
const BREAKPOINT = 1234;

if (document.documentElement.clientWidth < BREAKPOINT - ScreenHelper.getScrollbarWidth()) {
  // Логика для экранов с шириной меньше 1234px
}
```

Но **никогда** не делайте так в обработчике на скролл - зажмет нахрен!) Ширина скролла это в принципе такая вещь, которую необходимо учитывать в хорошем адаптивном веб-дизайне, но стоит вычислить и записать один раз. Для классового компонента React (но если может понадобиться больше одного раза - правильно при маунте лейаута записать в модуль стора для GUI): 

```jsx harmony
// В @/src/components/Component.jsx:
import React, { PureComponent } from 'react';

class SomeComponent extends PureComponent {
  constructor(props) {
    super(props);
  
    this.scrollbarWidth = null; // создаем чтобы хранить ширину скролла
  };

  componentDidMount() {
    // Записываем ширину скрола после монтирования:
    this.scrollbarWidth = ScreenHelper.getScrollbarWidth();
  };

  render() {
    return (
      // Разметка
    );
  };
};

export default SomeComponent;
```

Теперь предположим при тестировании верстки выяснилось что есть проблемы с iOS, которые необходимо фиксить. Нам нужно научить наш фронтенд отличать iOS - давайте посмотрим как легко можно расширять функционал модуля <code>ScreenHelper</code>:

```javascript
// В @/src/utils/screen-helper.js:

const ScreenHelper = (() => {
  // ... остальные методы

  // Добавляем метод для определения версии iOS:
  const getiOSversion = () => {
    if (/iP(hone|od|ad)/.test(navigator.platform)) {
      const v = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
      return parseInt(v[1], 10);
    }
    return null;
  };

  // И метод который нам нужен,
  // использующий первый:
  const isiOS = () => {
    if (getiOSversion()) return true;
    return false;
  };

  return {
    // ... остальные методы,
    // высовываем наружу то что нужно:
    isiOS,
  };
})();
```

### Layout контролирующий скролл

Давайте запилим большой важный классовый компонент <code>Layout</code> для React c роутером, который будет все это использовать, уметь отличать iOS и плюс еще реагировать на скролл - крайне распространенный кейс, например, нужно менять оформление, добавляя класс на <code>Header</code> при небольшом скролле и только на десктопах:

```jsx harmony
// В @/src/components/layout/Layout.jsx:
import React, { PureComponent, lazy } from 'react';
import { BrowserRouter, Switch, Route, Redirect } from 'react-router-dom';
import classNames from 'classnames';

import { DESIGN } from '../../store/constants';
import ScreenHelper from '../../utils/_screen-helper';

import '../../scss/components/layout/_layout.scss';

import Header from './Header';

// Ленивые роуты
const Main = lazy(() => import('../../views/Main'));
const View2 = lazy(() => import('../../views/View2'));
const View3 = lazy(() => import('../../views/View3'));

const Page404 = () => (
  <section className="page404">
    <h1>404</h1>
  </section>
);

// Константы для разметки
const LAYOUT_CLASS = 'layout';
const HEADER_CLASS = 'header';
const HEADER_ON_SCROLL_CLASS = `${HEADER_CLASS}--on-scroll`;

class Layout extends PureComponent {
  constructor(props) {
    super(props);
  
    this.state = {
      // scroll: 0, // если бы это было для чего-то нужно
    };
  };

  componentDidMount() {
    // Безопасная проверка поддержки:
    var passiveSupported = false;
    try {
      window.addEventListener(
        'test',
        null,
        // eslint-disable-next-line getter-return
        Object.defineProperty({}, 'passive', { get: function() { passiveSupported = true; } }));
    } catch(err) {}
  
    // Добавляем обработчик на скролл:
    window.addEventListener(
      'scroll',
      this.onScroll,
      passiveSupported ? { passive: true } : false,
    );
  };

  componentWillUnmount() {
    // Убиваем обработчик на стролле перед размонтированием:
    window.removeEventListener('scroll', this.onScroll);
  };

  // При скролле
  onScroll = () => {
    const scroll = window.pageYOffset || document.documentElement.scrollTop;
    this.checkScroll(scroll);
    // this.setState({ scroll: scroll }); // если бы было нужно
  };

  // Проверка скролла
  checkScroll = (scroll) => {
    // Внимание - верхняя обертка в <Header /> должна иметь атрибут id="header" !!!  
    const header = document.getElementById(HEADER_CLASS);

    // Так как у нас одинаковые брекпоинты с препроцессором,
    // можем спокойно использовать ScreenHelper.isDesktop() с window.matchMedia() 
    if (ScreenHelper.isDesktop() && scroll > 100) {
      header.classList.add(HEADER_ON_SCROLL_CLASS);
    } else {
      header.classList.remove(HEADER_ON_SCROLL_CLASS);
    }
  };

  render() {
    const layoutClasses = classNames(
      LAYOUT_CLASS,
      { [`${LAYOUT_CLASS}${DESIGN.OS_CLASS}`]: ScreenHelper.isiOS() },
    );

    return (
        <div className={layoutClasses} id="layout">
          <BrowserRouter>
            <Header />
            <main role="main">
              <Switch>
                <Redirect exact from='/' to='/main' />
                <Route path={ DESIGN.VIEWS[0].path } component={ Main } />
                <Route path={ DESIGN.VIEWS[1].path } component={ View2 } />
                <Route path={ DESIGN.VIEWS[2].path } component={ View3 } />
                <Route component={ Page404 } />
              </Switch>
            </main>
          </BrowserRouter>
        </div>
    );
  };
};

export default Layout;
```

## Деградация и сетки

Многим наверняка приходилось слышать о прогрессивных деградации и улучшении. Вы могли встретиться с этими темами в «~~билетах~~вопросах к собеседованиям на фронтенд-разработчика» или в содержании программ «курсов по верстке». В реальности, конечно же, все немного не так, как поют мотивированные коучи ~~и инфоцыгане~~. В боевой ситуации большинство будет выбирать некий однозначный общий подход, синтаксис, адекватный озвученным заказчиком требованиям к доступности интерфейса, и ему следовать. Сегодня, применяя [Autoprefixer](https://www.npmjs.com/package/autoprefixer) и поглядывая в [Can i use](https://caniuse.com/), вы можете писать достаточно современный кроссбраузерный код для всех последних версий modern-браузеров используя только то, что «все уже хорошо умеют». Но если вам попался заказчик-параноик, в статистике заходов у которого все-таки еще встречаются исчезающе мизерные доли «владельцев ослов» и он желает их обслужить - _у вас, конечно, проблемы_. Всегда, кстати, стоит попробовать побороться за качество своей жизни на работе и технологический прогресс заодно, объяснив, что, поддержка безнадежно устаревших сред, это, в любом случае, дополнительные трудозатраты на разработку. Этот аргумент иногда отлично срабатывает. 

Но как бы там ни было, мы обязаны постараться аккуратно исключить гипотетическую позорную ситуацию когда некий «владелец осла», ~~приковыляет~~зайдет на ваш сайт и вместо шикарного современного адаптивного дизайна увидит _хрен знает что_. Так может быть и c OS ранних версий, кстати. Или, если вы вынуждены обслуживать некоторые самые поздние версии IE, вам все равно необходимо закрыть более ранние. Давайте предотвратим некорректное отображение приложения в технологически устаревших средах с помощью аккуратной заглушки вежливо предлагающей пользователю «скачать уже себе нормальный бро»/«купить нормальное устройство». Если вы работаете с реактивным фреймворком для этого придется отвлечься от «сорцов» и занятся папкой <code>@/public</code> в которой находятся статические ресурсы для сборки. Добавим страницы заглушек рядом с основным статическим шаблоном вашего приложения <code>@/public/index.html</code>:

```
.
└─ public
   ├─ index.html
   ├─ legacyIE.html
   ├─ legacyIOS.html
   └─ ...
```

Добавляем скрипт в раздел <code>\<head></code> файла <code>@/public/index.html</code>, сразу после заголовочных тегов: 

```html
<!-- В @/public/index.html: -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Site title</title>
    <meta name="description" content="Site description" />

    <script>
      var ieVersion = (function() {
        var ua = window.navigator.userAgent;
        var msie = ua.indexOf('MSIE');
        if (msie > 0) {
          return parseInt (ua.substring(msie + 5, ua.indexOf('.', msie)));
        }
        if (ua.indexOf('Trident/7.0') + 1) {
          return 11;
        }
        return 0;
      })();
      if (ieVersion && ieVersion < 11) {
        location.href = './legacyIE.html';
      }

      if (/iP(hone|od|ad)/.test(navigator.platform)) {
        var v = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
        if (parseInt(v[1], 10) < 8) {
          location.href = './legacyIOS.html';
        }
      }
    </script>
  
    <!-- ... -->
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

И сами заглушки:

```html
<!-- В @/public/legacyIE.html: -->
<!doctype html>
<html lang="ru" style="color: #000000;background: #ffffff;height: 100%;">
<head>
  <meta charset="utf-8">
  <title></title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <link rel="icon" type="image/jpeg" href="./images/favicon.jpg" />
</head>
<body style="background: #000000;color: #ffffff;font: 13px/1.231 arial,helvetica,clean,sans-serif;*font-size: small;*font: x-small;width: 100%;margin: 0;padding: 0;height: 100%;">
  <div style="margin: 0;padding: 0;">
    <div id="message" style="margin: 0;padding: 0;font-size: 200%;line-height: 40px;letter-spacing: .045em;padding-top: 15%;padding-bottom: 50px;">
        <div class="wrapperMessage" style="margin: 0;padding: 0;width: 75%;margin-left: auto;margin-right: auto;margin-bottom: 75px;padding-left: 20px;padding-right: 20px;">You have an outdated version of the browser.<br />For full work on the Internet you need to download a modern browser,<br />for example &mdash; <a href="http://www.google.com/chrome/" target="_blank" style="white-space: nowrap;color:#ff0000;text-decoration:underline;">Google Chrome</a>, or &mdash; <a href="https://www.mozilla.org/" target="_blank" style="white-space: nowrap;color:#ff0000;text-decoration:underline;">Firefox</a>.
        </div>
    </div>
  </div>
</body>
</html>
```
```html
<!-- В @/public/legacyIOS.html: -->
<!doctype html>
<html lang="ru" style="color: #000000;background: #ffffff;height: 100%;">
<head>
  <meta charset="utf-8">
  <title></title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <link rel="icon" type="image/jpeg" href="./images/favicon.jpg" />
</head>
<body style="background: #000000;color: #ffffff;font: 13px/1.231 arial,helvetica,clean,sans-serif;*font-size: small;*font: x-small;width: 100%;margin: 0;padding: 0;height: 100%;">
  <div style="margin: 0;padding: 0;">
    <div id="message" style="margin: 0;padding: 0;font-size: 200%;line-height: 40px;letter-spacing: .045em;padding-top: 15%;padding-bottom: 50px;">
        <div class="wrapperMessage" style="margin: 0;padding: 0;width: 75%;margin-left: auto;margin-right: auto;margin-bottom: 75px;padding-left: 20px;padding-right: 20px;">You have an outdated version of the OS.</div>
    </div>
  </div>
</body>
</html>
```

И теперь, для того, чтобы, предположим, в IE11 все заработало с React, вам все равно придется подключить в сорцах необходимые специальные полифилы - в самом начале - в главном модуле <code>@/src/index.js</code>:   

```jsx harmony
// В @/src/index.js:
import 'react-app-polyfill/ie11';
import 'react-app-polyfill/stable';
// ...
```

Вот теперь все: странные пользователи зашедшие на ваш дизайн с определенных безнадежно устаревших версий IE или OS - будут надежно остановлены. Так стоит делать всегда, для любой веб-страницы которая предназначена на продакшен, для продакшена. Но давайте же уже перейдем собственно к теме раздела и рассмотрим реальный кейс в котором требуется _деградация_ сеток. 

Вы заметили что в примере «заглушка» для устаревших OS закрывает их только до седьмой версии? Если вы верстали «стабильно для modern», в восьмой OS на самом деле все может быть совсем неплохо, но точно не будут работать сетки на Grid и Flexbox. В этом вы сможете убедиться, например, взглянув на свои страницы через специальные сервисы, позволяющие удаленно тестировать различные среды на нативных устройствах. Почему нас это вообще должно волновать? Если посмотреть на [статистику](http://screensiz.es/phone) - iPhone4 или iPhone6 - до сих пор популярны и занимают долю рынка. Многие эти устройства могли быть выпущены, например, в 2013 году с OS8. Я, на самом деле, не знаю какова истинная вероятность того, что к вам придет пользователь с настолько _древним телефоном_, но, теоретически, похоже, _это возможно_. Так как речь идет только о сетках мы просто можем _деградировать_ все сетки на Grid на более ранние подходы - так, чтобы они корректно отображались во всех средах.

**Стабильная ритмичная пространственная раскладка, четкий ритм из ячеек из отступов - это сетка**. В modern для заурядного выражения такого поведения пространства следует выбирать собственно сетки, специализированную спецификацию [Grid Layout](https://developer.mozilla.org/ru/docs/Web/CSS/CSS_Grid_Layout/Basic_Concepts_of_Grid_Layout). В большинстве случаев сетки не бывают сложными и вам понадобятся самые простые конструкции из пары-тройки ячеек, например, в файле для сеток в стилевой базе препроцессора:
```scss
// В @/src/scss/core/_grid.scss:
$grids__gutter: 6%;

.grid {
  display: grid;
  gap: $grids__gutter;
  
  &--2 {
    grid-template-columns: 1fr 1fr; // ритм "на два"

    // Раскладываем все "в столбец" как обычно на мобильных:
    @include mobile {
      grid-template-columns: 1fr;
    }
  }

  &--3 {
    grid-template-columns: 1fr 1fr 1fr; // ритм "на три"

    @include mobile {
      grid-template-columns: 1fr;
    }
  }
}
```

И тогда в любом месте в шаблонах вы можете быстро кинуть, например, «адаптивную сетку на три» с помощью простой конструкции: 
```html
<div class="grid grid--3">
  <div></div>
  <div></div>
  <div></div>
</div>
``` 

Еще нам потребуется стилевая разметка, которая сможет придать «ритм на три» конструкции выше в устаревших средах. Большинство раньше и многие по-прежнему юзают такие «старые сетки» «на флоатах», я же, чаще всего, применял родственный, но более оригинальный-самописный подход с помощью укладывания в нужный ритм «строчных блоков»:

```scss
// В @/src/scss/core/_grid.scss:

// Old rubber grid mixin on inline-blocks for degradation
//////////////////////////////////////////////////////

// Примесь для построения простой резиновой сетки
// из заданного числа колонок
// с заданным резиновым отступом в процентах между ними
// @author Левон Гамбарян
//
// @param {Number} $columns - количество колонок
// @param {Percentage} $gutter - отступ в процентах
//
@mixin make-grid($columns, $gutter) {
  // Вычисляем ширину колонки
  $column-width: (100% - ($gutter * ($columns - 1))) / $columns;

  > div,
  > li {
    display: inline-block; // сетка на строчных блоках
    vertical-align: top;
    min-height: 1px;
    width: $column-width;

    // На мобильных - разворачиваем сетку в столбец
    @include xs {
      display: block;
      width: 100%;
    }

    // Выставляем отступ всем колонкам кроме последней
    &:not(:nth-child(#{$columns}n)) {
      margin-right: $gutter;

      // На мобильных выставляем нулевой отступ всем колонкам
      @include xs {
        margin-right: 0;
      }
    }

    // У последней колонки нет оступа
    &:nth-child(#{$columns}n) {
      margin-right: 0;
    }

    // Склеенные блоки
    @for $i from 2 to $columns {
      &.glued--#{$i} {
        width: $column-width * $i + $gutter * ($i - 1);

        @include xs {
          width: 100%;
        }
      }
    }
  }
}
```

В этом решении есть нетривиальный нюанс, сложная подробность, которая состоит в том, что наличие пробелов между блоками-ячейками в HTML может _все испортить_, в общем случае, для любых систем надежнее делать вот так:
```html
<div class="grid grid--3">
  <div></div
  ><!-- Вот в этих местах - не должно быть пробелов между блоками!!! --><div></div
  ><div></div>
</div>
```

Но при работе с шаблонизаторами в виде современных реактивных фреймворков можно об этом и не помнить. Теперь давайте уже сделаем деградацию - то есть так, чтобы все работало для в OS8 или IE11 . Для начала - научим наш лейаут отличать именно эти среды - в предыдущем разделе показано как это можно сделать с фреймворком. Мы хотим сделать совсем надежно и использовать свежую для CSS директиву <code>@supports</code> и миксин, а не плейсхолдер, поэтому:

```scss
// В @/src/scss/utils/_variables.scss:
$ie: '--ie';
$ios8: '--ios--8';

// В @/src/scss/core/_grid.scss:
// Примесь для деградации modern-сеток:
@mixin grid__degradation() {
  &--2 {
    @include make-grid(2, $grids__gutter);
  }

  &--3 {
    @include make-grid(3, $grids__gutter);
  }
}

.grid {
  // ...

  // Проверка поддержки:
  @supports not (display: grid) {
    @include grid__degradation;
  }

  // Абстрактное связывание с модификаторами главной обертки:
  .layout#{$ie} &,
  .layout#{$ios8} & {
    @include grid__degradation;
  }
}
```

Этот, пока еще вполне актуальный жизненный кейс, в который раз подчеркивает то, насколько мощный абстрактный препроцессор может быть лаконичен и эффективен в решении всевозможных нетривиальных задач, постоянно возникающих перед разработчиками в безумно быстро меняющихся средах браузеров и условиях веб-индустрии. И если «Осел» уже очень долгое время «находится на грани жизни и смерти», «в коме», и «очень многие согласны или требуют его отключить» )), то iOS доставит верстальщикам еще немало страданий и боли. В самом конце этого пособия будет рассмотрен случай с неожиданными проблемами и поведением как раз на самых последних моделях «айфонов».

## Адаптивные дизайнеры и резиновый дизайн

В, этой, концептуально - ключевой для всего трактата главе, хочется прежде всего поговорить о самых важных, рамочных абстрактных идеях описывающих современный и, возможно, даже будущий экранный дизайн.

В конце предыдущего раздела я упомянул сетки - важное базовое понятие, концепцию передачи пространственного ритма, которая перешла в веб-дизайн еще из намного более древней полиграфической печатной индустрии, как и то что связано со шрифтами, например. Но на практике, в сегодняшней айти-индустрии _дизайнеры такие дизайнеры_, и вам часто будет _не с кем поговорить_. Современные веб-дизайнеры, успешно работающие, выдающие симпатичный по стилю дизайн, очень часто, при этом, совсем не понимают и не используют сетки, в принципе не могут внятно ответить на самые простые вопросы по поводу основного поведения того что они уже нарисовали. Они способны действовать интуитивно и рефлекторно, визуально перенимая основные подходы, тренды, но у них _страдает теория_, и они в принципе, видимо, я стал так это понимать, _не мыслят концепциями_, рисуют, но _объяснить не могут_. Знаете что чаще всего приходится слышать верстальщику в ответ на вопросы относительно самых основных качеств пространства в принимаемой макете: «Ну вы ведь как-то это сможете сделать?», _тыжпрограммист_, одним словом. При этом, часто так и не удается добиться четкого формулирования того, _что именно_ нужно сделать.  

Но ведь в плане разметки интерфейса, ваша задача, как уже говорилось выше, как раз в том и состоит, чтобы эффективно перевести проект с _дизайнерского языка_ статичных графических прототипов на язык четких формальных абстракций, и, в конечном итоге - примитивной декларативной разметки для браузера, которая при этом, еще и будет вести себя динамично. Вам _нужно все понимать_, даже если автор макета сам не понимает.

В первом разделе мы в общем и целом определили понятие **адаптивного дизайна** - формальной системы _адаптации_ GUI интерфейса для экрана любого размера, на котором его может открыть пользователь. Этот подход последние годы стал, можно сказать, стандартом, мейнстримом. Все так делают. Большинство, вот - даже не понимая толком, а _что именно_ они делают. Давайте еще раз посмотрим на четкое определение адаптивного дизайна. Это система организации экранного пространства, которая:
* Определяется набором из **N > 0** контрольных точек - **брекпоинтов**, и **N + 1** построенных на них диапазонов отображения - **типоразмеров**;
* Для каждого из типоразмеров кроме наименьшего выбирается контейнер для контента шириной немного меньше значения начала диапазона. На наименьшем типоразмере - для мобильных устройств, смартфонов - контейнер занимает всю ширину экрана;
* Типографика может меняться между типоразмерами, но не меняется на всем протяжении каждого такого диапазона.

Большая часть дизайнов которые вы видите сегодня - или адаптивные или хотя бы минимально **отзывчивые**, то есть - реагируют на размер экрана который их показывает. Все эти подходы представляют собой, по сути, все тот же старый-добрый статичный подход, но чуть более гибко.

А каким еще может быть дизайн? В реальных проектах часто может подразумеваться что вы должны **отобразить макет на экране _пропорционально_**. Такой дизайн мы может определить как **резиновый**. Для того чтобы совсем наглядно это увидеть и понять можно поиграть с масштабом различных веб-страниц: те которые при масштабировании будут сильно меняться - это вариации статичного дизайна, те, которые при масштабировании менятся не будут совсем - резиновые. Скорее всего резиновых дизайнов вы почти не встретите. А почему? Реализовать такой дизайн для браузера несколько сложнее и невероятно сложно если вы не будете применять продвинутый препроцессор, например, подходы к нему озвученные данным руководством. Я покажу как без особых усилий можно совместить и резиновую и адаптивную техники для мощнейшей эргономики экранного пространства. И в конце даже пойду еще дальше - предложу свежее решение, которое, в будущем, способно полностью заменить «костыльный» и трудозатратный адаптивный подход - резиновым со всего двумя типоразмерами [спойлер: основанными на пропорции, а не на ширине вьюпорта].

Но прежде чем перейти к коду для простого резинового отображения макетов давайте затронем еще один важный концептуальный момент. Кроме способа адаптации, по каким основным рамочным качествам еще можно классифицировать дизайны?

Дизайны бывают:
* **вертикальные** - когда подача информации осуществляется последовательными блоками, секциями расположенными, чаще всего, друг-над-другом, слоями [но может быть и горизонтально]. Такие дизайны **показывают общий скролл** на подавляющем большинстве своих страниц (где контента больше чем помещается во вьюпорт);
* **рабочий стол** - когда весь интерфейс приложения располагается на одном экране, **общий скролл отсутствует**, хотя и может появляться для отдельных областей вьюпорта, _окон_.

На практике, я выяснил, что без подсказки многие дизайнеры не могут самостоятельно осознать простую мысль о том, что два прямоугольника с различными пропорциями невозможно пропорционально совместить, наложив друг-на друга. Ну просто _никак_. Если пропорции разные - у вас возникнет либо лишняя высота, либо ширина, при попытке вписать один прямоугольник в другой. Вертикальные дизайны легко можно реализовывать и через адаптивный и через резиновый подходы. «Рабочий стол» - возможно делать адаптивным, но вот с резиновой реализацией - возникнет проблема с разницей пропорций, между конкретным макетом - из «розового мира с единорожками», в котором любят пребывать дизайнеры - и реальной средой современных экранов которые могут быть практически любого размера и пропорции.

Мы можем уверенно отобразить макет пропорционально опираясь либо на ширину, либо на высоту вьюпорта, либо на то, либо на другое - с помощью современных [относительных единиц](https://www.w3schools.com/cssref/css_units.asp). В случае вертикального дизайна нам нужно использовать относительную ширину (или высоту если скролл горизонтальный - последнее время проявился усилился этот тренд), а в случае дизайна «рабочий стол» нам нужно решить как поступать с лишней высотой или шириной...

Размеры экранов очень сильно различаются, но для мобильных и планшетных экранов разброс по размерам качественно скромнее чем для «всех остальных экранов», условно - десктопов. Поэтому для «не гаджетов» для максимальной эргономии, скорее всего, придется добавлять дополнительные похожие типоразмеры.

C другой стороны на гаджетах существует следующие специфические сложности:
* Проблемы с реальной высотой вьюпорта и нативными панелями высота которых не учитывается;
* Огромная разница в пропорции у экранов мобильных устройств;
* Переворот.

В свете всего вышесказанного, сейчас, самым актуальным прогрессивным подходом представляется совмещение мобильного и планшетного адаптивных типоразмеров и хотя бы одного резинового десктопа. Такой метод способен сделать отображение на десктопах максимально адекватным и эргономичным, и при этом - избегает излишней сложности и проблем с реализацией для гаджетов.  

Давайте посмотрим как легко сделать это с помощью препроцессора, его переменных, функций и примесей, их композиций. Самое сложное для понимания - нам нужна некоторая переменная которая будет хранить **«резиновый пиксель»** - относительное значение через которое все соотношения в макетах будут транслироваться в верстке «пропорционально вьюпорту». Мы верстаем «относительно ширины», поэтому используем **vw**:

```scss
// В @/src/scss/utils/_variables.scss:
$rubber-pixel__width: 0.06 * 1vw;
```

Кроме того, это редкий кейс для которого требуется добавить именно функцию, которая будет при необходимости переводить пиксели в числа:

```scss
// В @/src/scss/utils/_functions.scss
/// Remove the unit of a length
/// @param {Number} $number - Number to remove unit from
/// @return {Number} - Unitless number
@function unitToNumber($number) {
  @if type-of($number) == 'number' and not unitless($number) {
    @return $number / ($number * 0 + 1);
  }

  @return $number;
}
```

Теперь мы можем делать c оформлением любой сущности в проекте:

```scss
// В @/src/scss/projects/_selector.scss
$selector__size--number: 100;
$selector__size--tablet: 100px;
$selector__size--mobile: 50px;

// Резина - трансляция свойств оформления через "относительный пиксель"
@mixin selector__rubber($pixel) {
  $size: $selector__size--number * $pixel;

  @include size($size, $size);
  @include text($font-family__sans, unitToNumber($font-size--small) * $pixel, $font-weight__sans__regular);
  line-height: unitToNumber($line-height--small) * $pixel;
}

.selector {
  // Основные общие стили -
  // типографика будет переписана дальше
  // в резиновой примеси только для десктопов
  @include text($font-family__sans, $font-size--small, $font-weight__sans__regular);
  
  // Резиновые декстопы
  @include dekstop {
    @include selector__rubber($rubber-pixel__width);
  }

  // Адаптация для планшетов
  @include tablet {
    @include size($selector__size--tablet, $selector__size--tablet);
  }

  // Адаптация для мобильных
  @include mobile {
    @include size($selector__size--mobile, $selector__size--mobile);
  }
}
```

Вуаля!

А теперь давайте чуть-чуть пофантазируем о прекрасном и неотвратимом будущем. Экраны уже сейчас такие разные по пропорциям и размеру. Можно ли гипотетически реализовывать резину годную для всех размеров и пропорций? На самом деле - можно. Представьте себе что у нас будет **всего 2 резиновых типоразмера - широкий и высокий**. Лейаут приложения с помощью javascript может определять пропорцию вьюпорта, и, основываясь на этом - отдавать ту или иную, более подходящую композицию. Так мы сможем легко, абсолютно универсально и стабильно обслужить, например - переворот на любых гаджетах.

В заключении хочется добавить что все это - совершенно жизненные и реальные кейсы, которые уже не раз встречались мне в реальной коммерческой практике, на самых разных проектах. И без препроцессора такие случаи, запросы-требования просто практически невозможно быстро и надежно реализовывать.

## Resize Me

В этой части пособия на конкретных, часто встречающихся в обычной практике, примерах применяется все то, что было предложено в первой. Все такие случаи, кейсы продиктованы всевозможными актуальными требованиями индустрии и технологий, постоянно эволюционирующего мира веб-браузеров и мобильных устройств. Размеры экрана гаджета не меняются, но устройство можно повернуть, или постоянно - открывается клавиатура снизу, меняя размер вьюпорта. Десктопный браузер «не поворачивается», но пользователь может открыть инспектор в том же окне или просто произвольно менять размеры всего окна. Есть даже определенный небольшое количество посетителей который привыкли к некоторому специфическому масштабированию в браузере. Людей с ограниченным зрением - крайне раздражает и обижает использование <code>user-scalable=no</code> для [Viewport](https://developer.mozilla.org/ru/docs/%D0%A1%D0%BB%D0%BE%D0%B2%D0%B0%D1%80%D1%8C/Viewport), хотя запрет масштабирования через этот атрибут, можно сказать, практически необходим для адаптивных лейаутов, чтобы они _не разваливались_ при этом. 

До сих пор, несмотря на очевидный прогресс спецификации и переход в повседневную практику верстальщиков таких мощных средств как, например, нативные раскладки пространства, относительные единицы или <code>calc()</code>, не все «хотелки» дизайнеров и заказчиков удается уверенно обслужить через CSS. То, что не тянут стили, закономерно ложиться на стрипты. В реальности по-прежнему часто необходимо манипулировать оформлением на DOM-элементах с помощью javascript. После загрузки контента страницы (после <code>load</code> на <code>window</code>, так как после загрузки DOM «уже можно, но еще не нужно») бывает необходимо еще немного «помочь стилям», осуществив некие, основанные на параметрах среды, вьюпорта, подсчеты и выставить правила с верными значениями прямо в инлайн-стили некоторых элементов. А что если пользователь после этого изменит размер вьюпорта, тоесть произойдет <code>resize</code>? Легко может _все сломаться_ и надо будет фиксить. 

Давайте пофиксим _раз и навсегда_. Для начала, чтобы вы все знали и понимали об этом, представим, что мы верстаем обычный лендинг, «по классике», с настолько минимальной функциональностью, что использовать фреймворк очевидно лишнее и ни для чего вообще не нужно. Как можно защитить на подобной верстке нем дизайн, зависящий от скриптов? **Выполнять все манипуляции со стилями каждый раз после того как размер окна изменился**. Используем [IIFE](https://developer.mozilla.org/ru/docs/%D0%A1%D0%BB%D0%BE%D0%B2%D0%B0%D1%80%D1%8C/IIFE) в es6-синтаксисе: 

```javascript
// Основной пересчёт/перерисовка
// Вся логика для манипулирования с DOM и оформлением на нем
// должна находиться внутри этой функции:
const redraw = () => {
  console.log('redraw!!!');
};

(() => {
  console.log('Поехали!!!');

  document.addEventListener('DOMContentLoaded', () => {
    console.log('event: DOM ready');

    redraw();
  });

  window.addEventListener('load', (event) => {
    console.log('event: window load');

    redraw();
  });

  window.addEventListener('resize', (event) => {
    console.log('event: window resize');

    redraw();
  });
})();
```

На практике, иногда вам еще может потребоваться нулевой или ненулевой таймаут в событии <code>load</code> или даже, в самых тяжелых случаях, каждый раз в <code>resize</code>, для того чтобы скрипты не ошибались в подсчетах:
```javascript
setTimeout(() => {
  redraw();
}, 0);
```

Это все, что нужно уметь чтобы защитить манипуляции с дизайном с помощью «просто javascript», без фреймворка.

### Resize в контексте фреймворка

Компонентные реактивные фреймворки в своей «чистой идеологии» в принципе не приветствуют прямые манипуляции с DOM, так как это, может конфликтовать с внутренней механикой фреймворка, привести с рекурсивному зацикливанию и так далее. Но одно дело идеалогия и романтика, другое дело - жизнь и практика. Я уже упоминал ситуацию (выставление класса при скролле), и в дальнейшем покажу еще несколько кейсов, в которых делать это необходимо.

Например, [с React](https://github.com/ushliypakostnik/react-scss-i18next), кажется грамотным взять сторонний модуль [react-resize-detector](https://www.npmjs.com/package/react-resize-detector) для надежной современной работы с ресайзом и построить на нем специальный контейнер, который будет писать в отдельный модуль стора необходимые нам параметры вьюпорта. Давайте как в примере для Vue в самом начале этой части руководства - выделим часть стора под работу с GUI:

```javascript
// В @/src/store/constants.js:

export const INITIAL_STATE = {
  rootReducer: {
    utils: {
      deviceType: null,
    },
  },
};


// В @/src/store/modules/utils/reducers.js:

import { combineReducers } from 'redux';

import utils from './modules/utils/reducer';

const rootReducer = combineReducers({
  utils,
});

export default rootReducer;


// В @/src/store/modules/utils/actions.js:

export const RESIZE = 'RESIZE';

export const resize = (deviceType) => ({
  type: RESIZE,
  deviceType: deviceType,
});


// В @/src/store/modules/utils/reducer.js:

import { INITIAL_STATE } from '../../constants';

import { RESIZE } from './actions';

const utils = (state, action) => {
  if (typeof state === 'undefined') {
    return INITIAL_STATE;
  }

  switch (action.type) {
    case RESIZE:
      return Object.assign({}, state, {
        deviceType: action.deviceType,
      });
    default:
      return state;
  }
};

export default utils;
```

Запилим классовый компонент для лейаута который будет уметь писать данные о вьюпорте в стор:

```jsx harmony
// В @/src/components/Layout/Resize.jsx:
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';

import ReactResizeDetector from 'react-resize-detector';

import { DESIGN } from '../../store/constants';

import { resize } from '../../store/modules/utils/actions';

import ScreenHelper from '../../utils/_screen-helper';

import '../../scss/components/layout/_resize.scss';

class Resize extends PureComponent {
  render() {
    return (
      <div className="resize">
        <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} />
      </div>
    );
  }

  getDeviceType = () => {
    if (ScreenHelper.isDesktop()) {
      return DESIGN.DEVICES_TYPES[0];
    } else if (ScreenHelper.isTablet()) {
      return DESIGN.DEVICES_TYPES[1];
    } else {
      return DESIGN.DEVICES_TYPES[2];
    }
  }

  onResize = () => {
    this.props.resize(this.getDeviceType());
  }
}

const mapDispatchToProps = (dispatch) => ({
  resize: (deviceType) => dispatch(resize(deviceType)),
});

export default connect(null, mapDispatchToProps)(Resize);
```

Стили чтобы вся конструкция заработала:

```scss
// В @/src/scss/components/layout/_resize.scss:
// Resize control
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

// тут нужно только для примеси size, конечно,
// но оставляем ради консистентности )
@import "../../_stylebase.scss";

%common {
  left: 0;
  right: 0;
  bottom: 0;
  top: 0;
  @include size(100%, 100%);
}

.resize {
  position: fixed;
  z-index: -1;

  &,
  > div {
    @extend %common;
  }

  > div {
    position: absolute;
  }
}
```

И в рендере <code>Layout</code>:
```jsx harmony
// В @/src/components/Layout/Layout.jsx:
<div className="layout" id="layout">
  <Resize />
  <BrowserRouter>
    ...
  </BrowserRouter>
</div>
```

Теперь стор знает о типоразмере которому в данный момент соответствует вьюпорт. Вы можете добавлять любые поля в хранилище и специфическую логику в компонент и модуль <code>ScreenHelper</code>.

Когда мы работаем с реактивным фреймворком речь идет о лаконично, логично и четко организованной поставленной системе. И чтобы она работала как надо, «как часы» - не стоит слишком усложнять! Хорошее программирование это когда мы действительно сложные вещи делаем понятно и просто, а не наоборот! Я думаю что в работе с Vue или React у нас есть только:
* Константы-конфигурация;
* Кастомные утилитарные модули;
* Компоненты и их переиспользуемая логика;
* Стор.

### Оффтоп: шина событий в Vue

Но, справедливости ради, после такого заявления, совершенно необходимо упомянуть о том, что Vue тут опять «отличился», тем, что легкомысленно позволяет организовать общение между компонентами еще и через настоящий «ход конем» - шину событий (Event Bus). Давайте посмотрим насколько это просто, ловко и при этом сомнительно). Для начала нужно инициировать глобальную шину в главном файле приложения <code>@/src/main.js</code>:

```javascript
// В @/src/main.js:
// Инициируем глобальную шину событий
Vue.prototype.$eventHub = new Vue();
```

Теперь в любом компоненте мы можем отправить на нее кастомное событие:
```vue
<template>
  <a
    href="#"
    @click.prevent="metod"
  />
</template>

<script>
  export default {
    name: 'EventTransmitter',

    methods: {
      metod() {
        // По клику на ссылку отправляем событие на глобальную шину:
        this.$eventHub.$emit('custom-event');
      },
    },
  };
</script>
```

И после этого - подписываться на событие в любых других компонентах:
```vue
<script>
  export default {
    name: "EventReceiver",

    created() {
      // Подписываемся на событие в глобальной шине:
      this.$eventHub.$on('custom-event', this.linkedMethod);
    },

    beforeDestroy() {
      // Внимание!!! - уничтожаем подписку перед размонтированием:
      if (this.$eventHub._events['custom-event'])
        this.$eventHub.$off('custom-event');
    },

    methods: {
      linkedMethod() {
        // ... Связанная с событием логика в компоненте-приемнике
      },
    },
  };
</script>
```

Удивительно безответственно!)) Да, с концептуальной точки зрения, это совсем непохоже на нечто, на чем можно уверенно строить действительно четкую ясную компонентную систему, очевидно создает лишнюю связность и может препятствовать переиспользуемости. Выглядит намного более опасно чем «абстрактное связывание» селекторов стилевой разметки, например. Но в реальной практике - бывает очень полезно как шустрый легкий выход из сложных частных ситуаций в GUI и логике представления, вариант для исключительных решений в них. Не нужно возиться с «серьезным» стором, раз - тут кинул, там и там поймал.

Да, начинал вроде за ресайз, но увлекся))...  

## Высота мобил

Существует по крайней мере один уникальный кейс в котором без Custom Properties не обойтись. Возможно, вы уже встречали этот пример в интернете, но без него рассказ о проблемах современных экранов не будет достаточно полным.

Многие мобильные устройства, например - от iOS, размещают свои «нативные панели», стандартные контролы поверх вьюпорта, скрадывая часть его высоты. При кажущейся незначительности этого момента, он вполне может приводить к серьезным затруднениям с UX/UI, блокируя важные пользовательские сценарии. Очень часто, например, на форме входа в интерфейс - дизайнер может поместить некую ключевую кнопку, контрол в нижней части страницы. Если отступа под ней будет недостаточно - на многих устройствах UX может оказаться частично или даже полностью заблокированным. Бороться с таким нативным поведением раньше можно было только «в лоб», тупо увеличивая отступы в таких опасных места до максимально надежных, внося «фиксы» в дизайн. Но, в некоторых случаях, это способно «изуродовать» UI, выглядит не особо адекватно в контексте всего остального стилевого решения. Выделять устройства и контролировать отступ для каждого бренда и модели - очевидно дурной подход с которым можно «глубоко надолго закопаться» и, в результате, все равно не чувствовать полной уверенности в успехе.     

И только Custom Properties в связке с javascript способны предоставить по-настоящему изящное и лаконичное универсальное решение проблемы.

Проблема в том, что если мы будем использовать «резиновые» проценты или единицы относительно высоты <code>vh</code> - браузер будет ошибаться, так как «ничего не знает» о нативных панелях устройства которые накладываются на вьюпорт сверху. Но с помощью javascript мы можем после загрузки контента страницы / монтирования лейаута во фреймворке быстро посмотреть реальный размер полезного окна и выставить всему документу скорректированное значение через кастомное свойство:   

```jsx harmony
import React, { PureComponent } from 'react';

class Layout extends PureComponent {

  // Тут вся магия:
  getRealViewportHeightUnit() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  componentDidMount() {
    this.goodHeight(); // Вызываем магию первый раз после монтирования лейаута
    window.addEventListener('resize', () => {this.getRealViewportHeightUnit()});
  };

  componentWillUnmount() {
    window.removeEventListener('resize', () => {this.getRealViewportHeightUnit()});
  };

  render() {
    return (
      // ... Разметка лейаута
    );
  };
};

export default Layout;
```

Если нам, например, нужен блок высотой ровно по экрану:

```scss
.viewport {
  // для браузеров которые не поддерживают Сustom Properties:
  height: 100vh; // деградация
  height: calc(var(--vh, 1vh) * 100);
}
```

## ARIA и навигация c клавиатуры

Очень многие нынешние разработчики забывают о том что профессионально сверстанный интерфейс обязан быть полностью доступен без мыши, с клавиатуры. Кажется что ерунда, но, на самом деле, это одна из тех вещей которая «была с самого начала» и представляет «нативную» среду веб-просмотрщиков, касается самой сути того, чем вы занимаетесь. «Рюшечки и котики» это все замечательно, но если разметка вашего интерфейса не дружит с [ARIA](https://developer.mozilla.org/ru/docs/Web/Accessibility/ARIA), тоесть - игнорирует потребности людей с ограниченными возможностями, или в вашей предназначенной для показа на десктопах верстке встречаются важные контролы, которые недоступны с помощью «основного терминала персонального компьютера» - вы явно не до конца понимаете что делаете, прямо как дизайнеры которые «рисуют по наитию, а не по сеткам». На самом деле, не расстраивайтесь слишком, ведь, с одной стороны, глобальный капитализм в котором мы все живем и работаем - удивительно странная штука, в которой непрофессионализм и некомпетентность отнюдь не становятся гарантией провала, и, наоборот - талант и глубокий специалист далеко не в каждой ситуации и команде бывает оценен по заслугам, добивается успеха. И мне приходилось встречать целых «технических директоров» успешных айти-стартапов, которые были вообще не вкурсе про ARIA и никогда не задумывались о доступности представлений, или даже вполне подкованных и влюбленных в веб-разработку топ-менеджеров проектов, но, которые, на полном серьезе, уверяли что «вся эта ваша семантика - это прошлый век и никому не нужно», «главное чтобы выглядело нормально и работало», «какая валидность» и так далее... А с другой стороны, никогда не поздно по-пролетарски подучиться и почитать спецификации. Пожалуйста, **если вы «не вкурсе о ARIA» - почитайте прямо сейчас, прежде чем снова садиться писать разметку**. Сложно представить, что в реальной ситуации таких «нюансов» верстки будет ожидать или требовать заказчик, и такой дотошный подход, по опыту, вполне может даже раздражать ваших коллег, «настоящих» программистов, например, что-то такое... Чаще всего от вас ждут результат «как можно скорее», а тестировщики тем более не ведают таких подробностей. Но в любом случае, вы должны, прежде всего «для себя», как профессионал, это знать и понимать, и в адекватных ситуациях, по возможности, применять на практике.

После того как вы _все сверстали_, каждый раз необходимо протестировать все «ручками»: поресайзить браузер на всех готовых шаблонах, перейти по ссылкам, поотправлять формы и так далее. Кроме всего этого, нажатие на TAB должно проводить вас по всем важным контролам - ссылкам-кнопкам, полям интерфейса имеющим значение для UX - фокусируясь на каждом. А нажатие на Enter, соответственно, триггерить, активизировать нужное поведение. И если у вас будет какой-нибудь сложный несемантичный специфический контрол - навигация с клавиатуры может его игнорировать. Необходимо добавить кастомную логику в javascript, чтобы это обслужить. Сначала сделаем так чтобы табуляция не пропускала контрол. Добавим класс <code>.before-control</code> контролу который получает фокус перед проблемным, и уникальный идентификатор <code>#control</code> самому элементу, с React:   

```jsx harmony
import React, { PureComponent } from 'react';

const BEFORE_CONTROL_CLASS = 'before-control';
const CONTROL_ID = 'control';

class Layout extends PureComponent {

  componentDidMount() {
    window.addEventListener('keydown', this.onKeyDown);
  };

  componentWillUnmount() {
    window.removeEventListener('keydown', this.onKeyDown);
  };

  // Фикс для доступности контрола
  onKeyDown = (e) => {
    let el;
    // Код клавиши TAB - 9
    // Элемент контрола который получает фокус перед проблемным
    // должен нести класс .before-control: 
    if (e.keyCode === 9 && e.target.classList.contains(BEFORE_CONTROL_CLASS)) {
      e.preventDefault();
      // Проблемный контрол должен нести уникальный идентефикатор #control
      el = document.getElementById(CONTROL_ID);
      if (el) el.focus(); // фокусируемся на проблемном контроле
    }
  };

  render() {
    return (
      // ... Разметка лейаута
    );
  };
};

export default Layout;
```

Теперь добавим правильное поведение в компоненте самого контрола - нажатие на Enter должно активировать поведение, такое же как и по клику:

```jsx harmony
import React, { PureComponent } from 'react';

const CONTROL_CLASS = 'control';

class Control extends PureComponent {

  componentDidMount() {
    window.addEventListener('keypress', this.onKeyPress);
  };

  componentWillUnmount() {
    window.removeEventListener('keypress', this.onKeyPress);
  };

  // Фикс для добавления правильного поведения
  // по нажатию Enter - код 13
  onKeyPress = (e) => {
    if (e.keyCode === 13 && e.target.classList.contains(CONTROL_CLASS)) {
      e.preventDefault();
      this.activateControl();
    }
  };

  activateControl = () => {
    // ... Логика поведения по контролу
  };

  render() {
    return (
      <div
        id={CONTROL_CLASS}
        aria-label="Control"
        className={CONTROL_CLASS}
        onClick={() => this.activateControl()}
      >
        <!-- ... Разметка контрола -->
      </div>
    );
  };
};

export default Control;
```

## Компенсация скролла при открытии модали

Один из самых часто используемых способов организовать диалог с пользователем в веб-дизайне это модаль или попап - UI-элемент называют и так и так. Вы можете использовать готовые решения с проработанной развитой функциональностью или создавать свое. Если страница поверх которой показывается попап имеет общий скролл - очень часто его блокируют через выставление правила <code>overflow: hidden;</code> на элемент <code>body</code>, и это просто категорически необходимо сделать для хорошего удобного UI, если у попапа может быть собственная вертикальная прокрутка. Когда общий стролл документа фиксируется - при ненулевом непрозрачном скролле вся страница очень некрасиво резко дергается вправо - возможно, вы замечали такое. Даже если модаль открывается на весь экран, но с задержкой на показ анимации - «артефакт» будет хорошо заметен.  Если я зайду к вам на сайт, открою модаль и замечу подобный «косяк», то уже не буду верить в то, что интерфейс создан действительно аккуратными и грамотными разработчиками.       

Фиксите такое обязательно! Это не сложно. Нам просто нужно сразу после блокирования общего скролла страницы «подложить» справа специальный элемент который будет «имитировать» полоску скроллбара, и потом убирать его при закрытии попапа. Стили для элемента:  

```scss
$popup-scrollbar__background: #f1f1f1;

.modal-scrollbar {
  background: $popup-scrollbar__background;
  position: fixed;
  top: 0;
  right: 0;
  z-index: $layout__modal - 100;
  @include size(0, 100vh);

  // На гаджетах не бывает скролла
  @include gadgets {
    display: none;
  }
}
```

Перейдем к механике фичи. Представим, что попап открывается по пропсу <code>isPopupOpen</code>. Eще очень важно - не забыть про позиционированые элементы с <code>position: fixed;</code> - если ширина страницы изменится - они тоже «прыгнут». Поэтому нам следует записать ширину страницы до скрытия общего скрола и потом выставить всем таким элементам. 

```jsx harmony
import ScreenHelper from '../../utils/_screen-helper';
// ... и остальные импорты

// Уникальные идентификаторы фиксированных элементов
const FIXED_ELEMENTS = ['fixed-block--1', 'fixed-block--2'];

class Popup extends PureComponent {
  constructor(props) {
    super(props);

    this.scrollbarWidth = null;
  };

  // Кэлбэк на открытие
  popupOpen() {
    this.scrollbarWidth = ScreenHelper.getScrollbarWidth();
    if (this.scrollbarWidth > 0) {
      const modalScrollbar = document.getElementById('modal-scrollbar');
      const width = document.body.clientWidth;
      document.body.style.cssText = `overflow-y: hidden; margin-right: ${this.scrollbarWidth}px`;
      FIXED_ELEMENTS.forEach(selector => {
        const el = document.getElementById(selector);
        if (el) el.style.width = `${width}px`;
      });
      if (modalScrollbar) modalScrollbar.style.width = `${this.scrollbarWidth}px`;
    }
  };

  // Кэлбэк на закрытие
  popupClose() {
    if (this.scrollbarWidth > 0) {
      const modalScrollbar = document.getElementById('modal-scrollbar');
      document.body.style.cssText = `overflow-y: scroll; margin-right: 0;`;
      FIXED_ELEMENTS.forEach(selector => {
        const el = document.getElementById(selector);
        if (el) el.style.width = ``;
      });
      if (modalScrollbar) modalScrollbar.style.width = 0;
    }
  };

  render() {
    const { isPopupOpen } = this.props;
 
    return (
      <Fragment>
        {isPopupOpen && <div className="modal-scrollbar" id="modal-scrollbar" />}

        <Modal
          isOpen={isPopupOpen}
          role="dialog"
          onAfterOpen={() => this.popupOpen()}
          onAfterClose={() => this.popupClose()}
        />
      </Fragment>
    );
  };
};

export default Popup;
```

## Разметка и способы переиспользования логики в React

В самой сути и синтаксисе React заложена некоторая двусмысленность, которая, как мне кажется, приводит к тому, что многие разработчики начиная работать с этим фреймворком поначалу не понимают четко «а как писать?», «функциями или классами?». Давайте разберемся.

Ппроекты бывают самые разные, с различной степенью детализации и прототипирования, всевозможной сложности и спектром требований к функциональности. В одном случае, вы имеете перед глазами законченный макет, техническое задание, и, даже, например, готовое API методов для взаимодействия с бэкэндом. В другом - должны реализовать быстрый прототип для проверки гипотезы, руководствуясь только условными набросками «на коленке». На самом деле, конечно, если я сам выбираю стек, в случае гибкого прототипа с отсутствующим или незаконченным проектированием GUI и туманными перспективами развития, я вообще возьму Vue, также как и для разработки библиотеки. React, имхо, лучше подходит для проектов с хорошо проработанными требованиями к логике и максимально целостными графическими прототипами. Ну или даже не важно: важны не сами инструменты, важно ваше понимание их сильных и слабых сторон и стратегий эффективного использования.

Отсутствие или недоработанность макетов не должна становиться для вас серьезным препятствием в работе. Оказавшись в такой ситуации, стоит даже воспринимать это за некий профессиональный вызов вашему опыту, разносторонним талантам и творческим способностям. Грамотное применение описанных в данном пособии подходов позволит вам играючи справиться с любой такой задачей.

### Функции

Но вернемся к React. Вероятно, стоит разделять бизнес-логику и, особенно, в случае действительно сложного дизайна - вьюху, представление. Модули обслуживающие данные и бизнес-логику над ними имеют отношение, прежде всего, к структуре самих данных, стору, состоянию приложения и вполне однозначно выводятся из требований. Таким образом, это нечто изначально сформулированное, четкое и практически незыблемое. А вот разметка видов, виджетов, элементов, их стилизация и связанная с ними логика поведения, очень часто могут «плыть», мутировать в результате вновь открывшихся при тестировании проблем и задач, требований, или даже просто - внезапно по прихоти заказчика. (Бизнес-логика также, конечно, может, но это более редкое явление и тяжелый процесс). Короче, очевидно, что при проектировании компонентной системы представлений стоит двигаться «от простого к сложному», и никак иначе, начиная с простых **фрагментов-функций**:

```jsx harmony
// Кусок разметки
const markupPiece = () => (
  <div />
);

// Компонент-функция: параметризированная вьюха
const parameterizedView = ({prop1, prop2}) => (
  <div
    attribute={prop1}
  >{prop2}</div>
);

// Компонент-функция: вьюха-обертка
const viewWrapper = props => (
  <div
    attribute={props.prop}
  >{props.children}</div>
);
```

Это самые простые случаи - переиспользуемая разметка. Чаще всего вам потребуется логика для такого компонента-функции:

```jsx harmony
import React, { Fragment } from 'react';

const View = () => {
  // ... Некая логика для этого представления

  return (
    <Fragment>
      ...
    </Fragment>
  );
};

export default View;
``` 

**Начинайте проектировать структуру и разметку представлений и простых переиспользуемых элементов с функций**, одним словом. В React 16.8 появилось мощнейшее средство для переиспользования логики в функциональном стиле - [Hook](https://ru.reactjs.org/docs/hooks-intro.html). Теперь, в огромном количестве случаев у вас нет никакой необходимости переписывать функцию на класс. И если вам необходимо добавить компоненту, например, состояние или эффект (те же «манипуляции на DOM», например), вы можете делать это ловко и изящно обходясь без громоздких классов.

У меня в целом сложилось ощущение, что функциональный стиль с Hook`ами замечательно хороши для внесения неких «точечных», локальных улучшений и изменений. И оказываются действительно полезны в ситуации когда вы _уже все сверстали_, но вам вдруг понадобилось добавить исключительное или дополнительное поведение не предусмотренное изначальной логикой. Давайте взглянем на пару небольших, но ярких примеров сейчас, а в следующей теме будет подробно рассмотрен еще один подобный кейс.

Вот очень жизненный пример: вы верстаете «вертикальный» дизайн с очень «длинными» страницами самой разной высоты. Если вы будете использовать Router, переход по роутам с помощью ссылок расположенных далеко «внизу», в «теле» страниц, не будет приводить «наверх» страницы отдаваемой по целевому роуту. Видимо, нам нужно добавить всему лейауту правильное поведение, когда при смене роута документ будет скроллиться до самого верха, в начало. Добавим компонент-функцию c хуком эффекта и хуком для роутера:

```jsx harmony
// В @/src/components/layout/ScrollToTop.jsx:
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]); // привязываем хук эффекта к смене роута

  return null;
};

export default ScrollToTop;
```

И в рендере компонента <code>Layout</code> с разметкой роутера:

```jsx harmony
// В @/src/components/Layout/Layout.jsx:
<div className="layout" id="layout">
  <ScrollToTop />
  <Header />
  <BrowserRouter>
    ...
  </BrowserRouter>
</div>
```

Все! Или такой частый случай: _вы уже все сверстали_, но тут вас попросили добавить некие новые виды с отличающимся оформлением какого-нибудь общего для всего лейаута элемента вне видов роутера, например, на <code>Header</code>:

```jsx harmony
// В @/src/components/utils/ExceptionalHeaderView.jsx:
import { useEffect } from 'react';

const ExceptionalHeaderView = () => {
  const HEADER = 'header'; // Header должен нести уникальный идентификатор
  const HEADER_ON_EXCEPTIONAL_VIEW_CLASS = `${HEADER}--on-exceptional-view`;

  useEffect(() => {
    const header = document.getElementById(HEADER);

    header.classList.add(HEADER_ON_EXCEPTIONAL_VIEW_CLASS);

    // В возврате - сбрасываем эффект
    return () => {
      header.classList.remove(HEADER_ON_EXCEPTIONAL_VIEW_CLASS);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

export default ExceptionalHeaderView;
```

И теперь просто добавляем компонент в разметку исключительных видов:

```jsx harmony
// В @/src/components/views/ExceptionalView.jsx:
import React, { Fragment } from 'react';

import ExceptionalHeaderView from '../utils/ExceptionalHeaderView';

const ExceptionalView = () => (
  <Fragment>
    <ExceptionalHeaderView />
    ...
  </Fragment>
);

export default ExceptionalView;
```

Это изменит стилизацию <code>Header</code> через добавление класса только на всех таких видах. Отлично!

Хуки дают разнообразные возможности для переиспользования логики в функциональном стиле, например, предоставляя доступ к классовым методам жизненного цикла компонентов **в неявном виде**.

### Классы

Теперь задумаемся, когда, в каких случаях с введением функциональных хуков остаются действительно нужны **классовые компоненты**? Нужно понимать, что в данном разделе, мы стараемся максимально кратко разобраться с достаточно запутанной темой, по поводу которой, похоже, нет простых формул и рецептов даже у самих разработчиков фреймворка. И, вследствие этого, данному вопросу посвящены многие подробные пассажи в его актуальной документации.

Концептуально, перевод функции в класс обозначает выделение новой высокоуровневой абстракции на уровне проекта. Но в цели и задачи этого пособия совсем не входит рассмотрение философских аспектов программирования. Я просто хочу подсказать начинающим «проторенную коллею», проверенное на практике направление движения, простые формальные способы восприятия основных рамочных концепций, пригодные, например, для того, чтобы скинуть оцепенение и начать действовать. Короче, классы необходимы только в следующих ясных случаях:

* **Логика компонента требует использования хуков жизненного цикла в явном виде**;
* **Компонент подключен к стору**.

И то и другое качество удобно и **необходимо переиспользовать в композициях с** [НОС - Компонентами высшего порядка](https://ru.reactjs.org/docs/higher-order-components.html). Кроме того, дополнительным способом переиспользования кода между классовыми компонентами являются [Рендер-пропы](https://ru.reactjs.org/docs/render-props.html#use-render-props-for-cross-cutting-concerns).  

По моему убеждению, HOC дают просто потрясающе мощное средство для оптимизации кода и логики приложения. С помощью них легко можно превратить сложные и запутанные «простыни» классовых компонентов, с повсеместно повторяющимся строчками и даже целыми пассажами - в простые и лаконичные выразительные конструкции, содержащие только уникальную непереиспользуемую функциональность. Помните, выше, мы научили модуль стора для GUI хранить актуальный типоразмер вьюпорта? Вот давайте посмотрим на то, как с помощью переиспользуемого HOC можно предоставить это поле стора и завязанную на нем логику в хуках жизненного цикла любому классовому компоненту. Пишем HOC:

```jsx harmony
// В @/src/components/hoc/withDeviceType.jsx:
import React, { PureComponent } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { DESIGN } from '../../store/constants';

import { someAction } from '../../store/modules/module/actions';

const withDeviceType = (Component) => {
  return class extends PureComponent {
    constructor(props) {
      super(props);

      this.state = {
        deviceType: null,
      };
    };

    // Обновляем пропс
    static getDerivedStateFromProps = (nextProps, prevState) => ({
      deviceType: nextProps.deviceType,
    });

    // Логика в хуке жизненного цикла
    componentDidUpdate() {
      const { deviceType } = this.state;
    
      // При обновлении компонента -
      // отправляем действие в стор, но только на мобилах.
      // Пример странный, но чтобы не усложнять
      if (deviceType === DESIGN.DEVICES_TYPES[2]) {
        this.props.someAction();
      }
    };

    render() {
      const { deviceType } = this.state;

      return <Component deviceType={deviceType} {...this.props} />;
    };
  };
};

// Мапим пропс в сторе
const mapStateToProps = (state) => ({
  deviceType: state.rootReducer.utils.deviceType,
});

// Мапим действие в сторе
const mapDispatchToProps = (dispatch) => ({
  someAction: () => dispatch(someAction()),
});

// Композиция
const Composed = compose(
  connect(mapStateToProps, mapDispatchToProps),
  withDeviceType,
);

export default Composed;
```  

И некий компонент в котором это требуется:

```jsx harmony
// В @/src/components/SomeComponent.jsx:
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { compose } from 'redux';

import withDeviceType from './hoc/withDeviceType';
// ... импорт остальных HOC

class SomeComponent extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      someProp: null, // непереиспользуемый с HOC пропс нужный состоянию компонента
    };
  };

  // Обновляем непереиспользуемый с HOC пропс
  static getDerivedStateFromProps = (nextProps, prevState) => ({
    someProp: nextProps.someProp,
  });

  componentDidMount() {
    // ... Логика при монтировании
  };

  render() {
    const { deviceType } = this.props;
    const { someProp } = this.state;

    return (
      <Fragment>
        ...
      </Fragment>
    );
  };
};

PostCards.propTypes = {
  someProp: PropTypes.array.isRequired,
};

// Мапим непереиспользуемый с HOC пропс в сторе
const mapStateToProps = (state) => ({
  someProp: state.rootReducer.module.someProp,
});

// Композиция
const Composed = compose(
  connect(mapStateToProps, null),
  withDeviceType,
  // ... другие HOC
);

export default Composed(SomeComponent);
```

Это в самых общих чертах объясняет как нужно поступать при создании компонентной системы для представлений, вьюхи и GUI. Начинаете с простых функций. В тех случаях, когда можно и проще обойтись легкими изящными хуками, прежде всего - применяете их. И только для явно завязанной на хуках жизненного цикла, а также для всей взаимодействующей со стором приложения логики - выделяете абстракции: классы в композициях с переиспользуемыми НОС. 


## Случай c айфонами, новыми тагами и hook`ами на React

Давайте на жирном актуальном случае из реальной практики применим идеи высказанные в нескольких последних разделах. Недавно мне пришлоь работать над очень красивым современным сайтом, с действительно шикарным дизайном. Руководство предоставило мне достаточно времени, дало возможность подойти к задаче действительно тщательно. Поэтому я трудился с вдохновением и усердием, не жалея своих сил, применяя все самые актуальные последние возможности и приемы. Например, решил разметить картинки контента с помощью «свежих» HTML-элементов [\<picture>](https://developer.mozilla.org/ru/docs/Web/HTML/Element/picture) и [\<source>](https://developer.mozilla.org/ru/docs/Web/HTML/Element/source) позволяющих использовать продвинутые форматы изображений, а также атрибута <code>srcSet</code> ([img](https://developer.mozilla.org/ru/docs/Web/HTML/Element/img)), который предоставляет удобный синтаксис для обслуживания ретинных дисплеев с повышенной плотностью пикселей. Разработка велась на React и я сформировал утилитарный компонент-функцию для обслуживания всех картинок контента в интерфейсе. Все было, конечно, несколько сложнее, но, упрощая, нечто такое:  

```jsx harmony
import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import ScreenHelper, { designVersion } from '../../utils/_screen-helper';

const Image = ({image, name}) => {
  return (
    <picture>
      {image.webp &&
        <Fragment>
          <source
            srcSet={`${designVersion(image.webp.desktop.old)}, ${designVersion(image.webp.desktop.retina)} 2x`}
            media={`(min-width: ${ScreenHelper.MD}px)`}
            type="image/webp"
          />
          <source
            srcSet={`${designVersion(image.webp.gadgets.old)}, ${designVersion(image.webp.gadgets.retina)} 2x`}
            media={`(max-width: ${ScreenHelper.MD - 1}px)`}
            type="image/webp"
          />
        </Fragment>}
      <img
        className="visible--desktop"
        src={designVersion(image.desktop.old)}
        srcSet={`${designVersion(image.desktop.retina)} 2x`}
        alt={name}
      />
      <img
        className="visible--gadgets"
        src={designVersion(image.gadgets.old)}
        srcSet={`${designVersion(image.gadgets.retina)} 2x`}
        alt={name}
      />
    </picture>
  );
};

Image.defaultProps = {
  image: {},
  name: '',
};

Image.propTypes = {
  image: PropTypes.object,
  name: PropTypes.string,
};

export default Image;
```

Обратите внимание на метод <code>designVersion()</code> оборачивающий адреса до ресурсов и позволяющий обновить все изображения закэшированные на клиентах простым увеличением индекса в конфигурации:

```javascript
// В @/src/utils/contstans.js:
export const DESIGN = {
 V: 1234,
 // ...
};

// В @/src/utils/screen-helper.js:
import { DESIGN } from '@/utils/constants';

export const designVersion = (src) => {
  return `${src}?v=${DESIGN.V}`;
};
```

Одной из вьюх была конструкция, представляющая собой flexbox-контейнер, верхнюю часть которого занимает контент неизвестного объема, а нижнюю - как раз этот самый <code>\<picture></code> с <code>\<img></code> внутри:

```scss
.card {
  display: flex;
  flex-direction: column; // вертикальная главная ось
  
  picture {
    display: block;
    overflow: hidden;
  }

  img {
    // чтобы картинка располагалась по центру, несмотря на любую высоту блока:
    object-fit: cover;
    @include size(100%, 100%);  
  }
}
```

Сайт запустили в production, с минуты на минуту на него должны были начать ходить пользователи. И тут мы обнаруживаем, что и я, и тестировщики проморгали то, что на всех именно «последних айфонах» - от восьмого до одиннадцатого - и в Chrome и в Safari - картинка не центрируется. В декстопном Safari - все нормально, а на смартфонах - нет. Вот это правило не работает:

```scss
.card img {
  height: 100%;
}
```  

Я, конечно, сначала попытался пофиксить с помощью CSS, но очень похоже на аппаратную проблему (_iOS такие iOS_), и это достаточно тяжело делать для мобильного устройства, которого, к тому же, у тебя нет физически - через специализированный инструмент-сервис. Время поджимало и я просто дописал в компонент hook на рефах c ресайзом:

```jsx harmony
import React, { Fragment, useEffect, useRef } from 'react';
// ...

const Image = ({image, name, setHeight}) => {
  // Рефы на элементы
  const pictureElement = useRef(null);
  const imageDekstopElement = useRef(null);
  const imageGadgetsElement = useRef(null);

  useEffect(() => {
    const updateImageHeight = () => {
      // Шок, но по-старинке нужно применить нулевой таймаут,
      // иначе ошибается, причем только на части экземпляров, что загадочно
      setTimeout(() => {
        let height;
        if (pictureElement.current) height = pictureElement.current.clientHeight;
        if (imageDekstopElement.current && height && height !== 0) imageDekstopElement.current.style.height = `${height}px`;
        if (imageGadgetsElement.current && height && height !== 0) imageGadgetsElement.current.style.height = `${height}px`;
      }, 0);
    };

    if (setHeight) {
      window.addEventListener('resize', updateImageHeight);
      updateImageHeight(); // Вызываем первый раз
    }

    // В возврате из эффекта - убиваем обработчик
    return () => {
      if (setHeight) window.removeEventListener('resize', updateImageHeight);
    };
  // Передаем пропс который использует эффект, 
  // иначе работать будет, но с варнингом от линтера!
  }, [setHeight]);

  return (
    <picture ref={pictureElement}>
      ...
      <img
        ref={imageDekstopElement}
        ...
      />
      <img
        ref={imageGadgetsElement}
        ...
      />
    </picture>
  );
};

Image.defaultProps = {
  // ...
  setHeight: false,
};

Image.propTypes = {
  // ...
  setHeight: PropTypes.bool,
};

export default Image;
```

Теперь мы можем в разметке только для нужных картинок включать «выставление высоты» для <code>\<img></code> по высоте <code>\<picture></code>.

Эта история говорит в пользу аккуратного и даже дотошного компонентного подхода, когда у вас все унифицировано, «сосредоточено в одной точке», и возможно просто добавлять нужную функциональность. Она еще раз показывает силу, мощь и лаконичность хуков в React, а также то, что в мире современных веб-технологий по-прежнему нужно все очень хорошо проверять и перепроверять, «от всего ждать подвоха», и особенно - применяя новые возможности спецификаций... И даже от самых распиаренных и дорогих устройств. Прежде всего от них, на самом деле.))

## Песочницы

Я заметил что многие программисты не имеют полезной привычки строить **«песочницы» для development**. Такие выделенные виды крайне удобны и порой даже просто необходимы для разработки, изолированного тестирования или демонстрации. Для наглядной и четкой презентации единого стиля, его шаблонов, компонентов, виджетов, элементов, проверки гипотез и четкого контроля уже имеющихся решений по проекту. Во-первых, нужно потратить всего несколько минут чтобы вытащить такой вид на отдельный роут только для dev mode. Во-вторых, вот конкретный жизненный пример: в гибко и медленно развивающимся «долгострое» над которым трудиться например несколько человек или даже, бывает, команд - очень активно используются всевозможные пиктограммы-иконки. Иконок в UI, дизайн-системе в принципе очень много, постоянно добавляются новые или должны переиспользоваться уже имеющиеся. Раньше, когда иконки были часто PNG-картинками - они были «видны», можно было «потыкать-пощелкать» прямо из IDE, и, например, удостовериться что новая иконка не дублирует старую под другим именем. Теперь же когда иконки чаще всего стали SVG-файлами, кодом, отсутствие четкой системы контроля приводит к тому, что папка с иконками в проекте начинает напоминать помойку. Для того чтобы решить проблему - необходимо всего лишь добавить только для режима разработки тестовый роут и поставить на него все иконки, например для Vue:

```javascript
// В @/src/router.js
import Icons from "@/views/sandboxes/Icons.vue";

...

// Sandbox pages routes only for development mode
if (process.env.NODE_ENV === "development") {
  routes.push(
    {
      path: "/icons",
      name: "Iocns",
      component: Icons,
    },
    ...
  );
}
```

Теперь мы можем без особого труда собрать вместе все уже имеющиеся иконки в одном наглядном компоненте и, к примеру, вычистить повторяющиеся:

```vue
<!-- В @/src/components/views/sandboxes/Icons.vue: -->
<template>
  <Icon1 />
  <Icon2 />
  <!-- ... и так далее -->
</template>

<script>
  import Icon1 from "@/src/components/Icons/Icon1";
  import Icon2 from "@/src/components/Icons/Icon2";
  // ... и так далее

  export default {
    name: "Icons",

    components: {
      Icon1,
      Icon2,
      // ... и так далее
    },
  };
</script>
```

Использование песочниц отлично помогает выявлять и решать конфликты в стилях. При быстром прототипировании, работе без гайдлайна и/или макетов формировать такую «библиотеку шаблонов» практически необходимо.

Систематическое введение в будничную практику идей и подходов описанных в этом руководстве, должно помочь сделать GUI ваших веб-приложений современным и доступным, а код для него аккуратным и качественным, емким и выразительным. Гибким и пригодным для поддержки, развития.

Спасибо что читали! Успехов в труде и творчестве!
