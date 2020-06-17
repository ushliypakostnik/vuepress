# Препроцессор, JavaScript и фреймворки

Ого, вы еще читаете?!.. Отлично!

Во второй части пособия идеи и подходы станут менее скандальными, так как мы просто разберем несколько жизненных и углубленных основных кейсов современного экранного дизайна. И если в поначалу темы будут еще наглядно применять мощный и гибкий, но «достаточно спорный» подход к препроцессору, описанный в первой части трактата, то дальше речь пойдет уже сугубо об использовании javascript для GUI и доступности в контексте популярных реактивных фреймворков.

## Темизация

Очень часто встречающимся кейсом является темизация. Ваш заказчик вполне может захотеть чтобы светлый интерфейс продукта _ночью глаза клиентам не резал_. А вы _уже все сверстали_, пичалька...

Справедливости ради, нужно упомянуть что ссылка на пример с [темизацией на Styled Components с React и TypeScript](https://github.com/ushliypakostnik/react-auth/tree/master/src/theme) уже встречалась в тексте в самом конце рассказа о препроцессоре, когда разговор зашел о компонентности и несвязности, плюс это один из немногих кейсов, в котором использование просто самих Custom Properties кажется вполне эффективным. Готовые модули часто стали применять такой подход к кастомизации. Ну это явно получше чем тонна невменяемого CSS. О действительно уникальном кейсе когда «нативные переменные» оказываются единственным изящным выходом из сложной ситуации будет рассказано немного ниже. 

Давайте запилим все на [Vue c SCSS](https://github.com/ushliypakostnik/vue-scss-i18next/tree/master/src). Надеюсь что вы все поняли из первой части, и в вашем проекте все цвета дотошно абстрагированны в переменных стилевой базы. Иначе, конечно, _ничего не получится_.

Что мы должны добавить в проект в самую первую очередь? Как в случае стилей, это, по моему убеждению, должны быть глобальные переменные перпроцессора, **для javаscript нужно первым делом определить константы** которые будет использовать вся остальная система. Так как информацию о том, какую тему последний раз выбрал пользователь мы планируем хранить в Local Storage браузера (вы можете также использовать технологию cookies или Session Storage, в зависимости от ситуации), нужно создать поле для этого, а также определить сами темы - мы собираемся сделать дневную и ночную. В <code>@/src/utils/constants.js</code>:

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

Если в локальном хранилище нет записи о выбраной теме - выставляем ночную по дефолту.

Следующей вещью которая дейтвительно важна в реактивном приложении является его стор. Несмотря на то, что тема оформления никак не касается данных и бизнес-логики, и знать о ней, предположительно, будут только два компонента: модуль переключения и какая-то верхняя обертка, которой мы будем выставлять модификатор для верстки, мы все равно планируем организовать это общение через иммудабельный стор. Выделим в нем модуль который будет обслуживать различные функциональности для GUI, добавим стору в <code>@/src/store/index.js</code>:  

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

Вся внутренняя кухня для того чтобы менять тему готова и можно перейти к разметке. Так как цвета нужно менять даже для самой верхней обертки в GUI, класс модификатор распрастраняющий изменения по верстке мы будем выставлять «прямо на всем приложении», в главном шаблоне <code>@/src/App.vue</code> который использует <code>\<router-view /></code> роутера - точку в которой будут монтироваться остальные компоненты, и основной файл <code>@/src/scss/_main.scss</code> собирающий стили. Подписываем этот компонент на геттер нужного поля стора:
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

Такой подход способен сделать темизацию вашего интерфейса легким и приятным занятием. Код препроцессора не повторяется и остается максимально выразительным. Этот шикарный кейс еше раз подчеркивает что возможности глобальной абстракции стилей препроцессором оказываются крайне эффективны именно в грамотной связке с актуальными компонентными подходами. Каждый занимается своим делом. **Компонентный фреймворк обслуживает функциональность, тогда как препроцессор занимается оформлением.**

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
  OS_8_CLASS: '--ios-8',
};
```

Это _все та же песня_ про необходимость унификации и стандартизации, соглашений особенно при работе командой. То были _какие-то_ стили, а тут речь идет уже, _на минуточку_, о языке программирования. Перестаньте писать разметку и компоненты, добавлять им функциональность основываясь на раскиданных по всему проекту магических числах и строках, локальных утилитарных и дублирующихся глобально частных функциях. Вы не должны напрягаться и судорожно искать где и что находится или происходит, в одном месте поправил, _в другом отломалось_. **Предоставьте все глобально: основную конфигурацию, абстракции дизайн-макета, требуемого поведения оформления и основанные на них переиспользуемые утилитарные модули-функции.**

Прежде всего для адаптивности нам нужны <code>DESIGN.BREAKPOINTS</code> - очень важно: точно такие же как в препроцессоре. При использовании описанной методы - нет возможности сделать это «один раз» - сразу и для js и для препроцессора. Или, например, конфигурация основных видов для роутера <code>DESIGN.VIEWS</code> - скорее всего будет просто более-менее соответствовать количеству макетов проекта.

### Константы уровня компонента

Кейсов в которых удобно вводить константы на уровне компонента также много, но они достаточно частные. Поэтому я покажу только один важный кейс, который напрямую связан с озвученными выше подходами к разметке и композиции селекторов. Вспомним наш самый распрастраненный паттерн «рядовое переиспользование модуля в отдельном конкретном виде». Посмотрим как это будет на React. 

Используем простейшие прототипы на функциях, модуль [classnames](https://www.npmjs.com/package/classnames) и [Шаблонные строки](https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/template_strings):

Компонент:
```jsx harmony
// В @/src/components/component.js:
import React, { PureComponent } from "react";
import classNames from 'classnames';
import PropTypes from "prop-types";

import '../../scss/components/_component.scss';

const Component = ({ view }) => {
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

Component.propTypes = {
  view: PropTypes.string.isRequired,
};

export default Component;
```

Некая **вьюха** которая его переиспользует:
```jsx harmony
// В @/src/components/views/view.js:
import React from "react";

import { DESIGN } from '../../store/constants';

import Component from '../../components/component';

import '../../scss/views/_view.scss';

const View = () => {
  const VIEW_CLASS = 'view';

  return (
    <div
      id={`${VIEW_CLASS}`}
      className={`${VIEW_CLASS}`}
    >
      <div class={`${VIEW_CLASS}__component-wrapper`}>
        <Component view={DESIGN.COMPONENT_VIEWS[1]} />
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

В даже минимально сложных разветвленных проектах между конфигурацией и логикой в компонентах удобно сформировать еще один слой утилитарных переиспользуемых модулей со стандартной функциональностью. Это например функции-валидадоты, модуль стандартизирующий взаимодействие по API, модуль взаимодействующий с браузерным хранилищем, конфигурация переводчика. Очень удобно выделить в отдельный модуль все функции которые нужны для взаимодействия с экраном и GUI - ведь одних только значений брекпоинтов и скорости анимации в константах явно недостаточно - нужно еще и нечто способное разнообразно и эффективно с этим работать, и чему вы сможете добавлять функционал по необходимости - в <code>@/src/utils/screen-helper.js</code>: 

```javascript
// В @/src/utils/screen-helper.js:
import { DESIGN } from '@/utils/constants';

// Модуль экранный помощник
const ScreenHelper = (() => {
  /* eslint-disable no-unused-vars */
  const NAME = 'ScreenHelper';

  // Брекпоинты и типоразмеры.
  // Конфигурируем "ручками" глобальные качества обслуживаемого дизайна:
  // нам неободимо выразить брекпоинты через типоразмеры-сравнения с window.matchMedia().
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

Но **никогда** не делайте так в обработчике на скролл - зажмет нахрен!) Ширина скролла это в принципе такая вещь, которую стоит учитывать в хорошем адаптивном веб-дизайне, но приемлимо - вычислить и записать один раз. Если это классовый компонент React, то: 

```jsx harmony
// В @/src/components/layout/Layout.jsx:
import React, { PureComponent } from "react";

class Layout extends PureComponent {
  constructor(props) {
    super(props);
  
    this.scrollbarWidth = null; // создаем чтобы хранить ширину скролла
  };

  componentDidMount() {
    // Записываем ширину скрола после монтирования лейаута:
    this.scrollbarWidth = ScreenHelper.getScrollbarWidth();
  };

  render() {
    return (
      // Разметка
    );
  };
};

export default Layout;
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

Давайте запилим большой важный классовый компонент <code>Layout</code> для React c роутером, который будет все это использовать, уметь отличать iOS и плюс еще реагировать на скролл - крайне распрастранненный кейс, например, нужно менять оформление, добавляя класс на <code>Header</code> при небольшом скроле и только на десктопах:

```jsx harmony
// В @/src/components/layout/Layout.jsx:
import React, { PureComponent, lazy } from "react";
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

Но как бы там ни было, мы обязаны постараться аккуратно исключить гиппотетическую позорную ситуацию когда некий «владелец осла», ~~приковыляет~~зайдет на ваш сайт и вместо шикарного современного адаптивного дизайна увидет _хрен знает что_. Так может быть и c OS ранних версий, кстати. Или, если вы вынуждены обслуживать некоторые самые поздние версии IE, вам все равно необходимо закрыть более ранние. Давайте предотвратим некорректное отображение приложения в технологически устаревших средах с помощью аккуратной заглушки вежливо предлагающей пользователю «скачать уже себе нормальный бро»/«купить нормальное устройство». Если вы работаете с реактивным фреймворком для этого придется отвлечься от «сорцов» и занятся папкой <code>@/public</code> в которой находятся статические ресурсы для сборки. Добавим страницы заглушек рядом с основным статическим шаблоном вашего приложения <code>@/public/index.html</code>:

```
.
└─ public
   ├─ index.html
   ├─ legacyIE.html
   ├─ legacyIOS.html
   └─ ...
```

Добавляем скрипт в раздел <code>\<head></code> файла <code>@/public/index.html</code>, сразу после заголовочных тагов: 

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

И теперь, для того, чтобы, предположим, в IE11 все заработало с React, вам все равно придется поключить в сорцах необходимые специальные полифилы - в самом начале - в главном модуле <code>@/src/index.js</code>:   

```jsx harmony
// В @/src/index.js:
import 'react-app-polyfill/ie11';
import 'react-app-polyfill/stable';
// ...
```

Вот теперь все: странные пользователи зашедшие на ваш дизайн с определенных безнадежно устаревших версий IE или OS - будут надежно остановлены. Так стоит делать всегда, для любой веб-страницы которая предназначена на продакшен, для продакшена. Но давайте же уже перейдем собственно к теме раздела и рассмотрим реальный кейс в котором требуется _деградация_ сеток. 

Вы заметили что в примере «заглушка» для устаревших OS закрывает их только до седьмой версии? Если вы верстали «стабильно для modern», в восьмой OS на самом деле все может быть совсем неплохо, но точно не будут работать сетки на Grid и Flexbox. В этом вы сможете убедиться, например, взглянув на свои страницы через специальные сервисы, позволяющие удаленно тестировать различные среды на нативных устройствах. Почему нас это вообще должно волновать? Если посмотреть на [статистику](http://screensiz.es/phone) - iPhone4 или iPhone6 - до сих пор популярны и занимают долю рынка. Многие эти устройства могли быть выпущенны, например, в 2013 году с OS8. Я, на самом деле, не знаю какова истинная вероятность того, что к вам придет пользователь с настолько _древним телефоном_, но, теоритически, похоже, _это возможно_. Так как речь идет только о сетках мы просто можем _деградировать_ все сетки на Grid на более ранние подходы - так, чтобы они корректно отображались во всех средах.

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

В этом решении есть нетривиальный ньюанс, сложная подробность, которая состоит в том, что наличие пробелов между блоками-ячейками в HTML может _все испортить_, в общем случае, для любых систем надежнее делать вот так:
```html
<div class="grid grid--3">
  <div></div
  ><!-- Вот в этих местах - не должно быть пробелов между блоками!!! --><div></div
  ><div></div>
</div>
```

Но при работе с шаблонизаторами в виде современных реактивных фреймворков можно об этом и не помнить. Теперь давайте уже сделаем деградацию - тоесть так, чтобы все работало и для OS8. Для начала - научим наш лейаут отличать именно эту среду - в предыдущем разделе показано как это можно сделать с фреймворком. Мы хотим сделать совсем надежно и использовать свежую для CSS директиву <code>@supports</code> и миксин, а не плейсхолдер, поэтому:

```scss
// В @/src/scss/utils/_variables.scss:
$ios-8: '--ios-8';

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

  // Абстрактное связывание с модификатором обертки:
  .layout#{$ios-8} & {
    @include grid__degradation;
  }
}
```

Этот, пока еще вполне актуальный жизненный кейс, в который раз подчеркивает то, насколько мощный абстрактный препроцессор может быть лаконичен и эффективен в решении всевозможных нетривиальных задач, постоянно возникающих перед разроботчиками в безумно быстро меняющихся средах браузеров и условиях веб-индустрии. И если «Осел» уже очень долгое время «находится на грани жизни и смерти», «в коме», и «очень многие согласны или требуют его отключить» )), то iOS доставит верстальщикам еще немало страданий и боли. Немного дальше в этом пособии будет рассмотрен случай с неожиданными проблемами и поведением как раз на самых последних моделях «айфонов».

## Адаптивные дизайнеры и резиновый дизайн

В, этой, на самом деле - ключевой для всего текста главе, хочется прежде всего поговорить о самых рамочных, абстрактных идеях современного и, возможно, даже будущего экранного дизайна. 

В конце предыдущего раздела я упомянул сетки - важное базовое понятие, концепцию передачи пространственного ритма, которая пришла в веб-дизайн еще из намного более древней полиграфической печатной индустрии, как и то что связано со шрифтами, например. Но на практике, в сегодняшней айти-индустрии _дизайнеры такие дизайнеры_, и вам часто будет _не с кем поговорить_. Современные веб-дизайнеры, успешно работающие, выдающие симпатичный по стилю дизайн, очень часто, при этом, совсем не понимают и не используют сетки, в принципе не могут внятно ответить на самые простые вопросы по поводу основного поведения того что они уже нарисовали. Они способны действовать интуитивно и рефлекторно, визуально перенимая основные подходы, тренды, но у них _страдает теория_, и они в принципе, видимо, я стал так это понимать, _не мыслят концепциями_, русуют, но _объяснить не могут_. Знаете что чаще всего приходится слышать верстальщику в ответ на вопросы относительно самых основных рамочных качеств пространства в принимаемой макете: «Ну вы ведь как-то это сможете сделать?», _тыжпрограммист_, одним словом. При этом, часто так и не удается добиться четкого формулирования того, _что именно_ нужно сделать.  

Но ведь в плане разметки интерфейса, ваша задача, как уже говорилось выше, как раз в том и состоит, чтобы эффективно перевести проект с _дизайнерского языка_ статичных графических прототипов на язык четких формальных абстракций, и, в конечном итоге - примитивной декларативной разметки для браузера, которая будет вести себя динамично. Вам _нужно все понимать_, даже если автор макета сам не понимает.

В первом разделе мы в общем и целом определили понятие **адаптивного дизайна** - формальной системы _адаптации_ GUI интерфейcа для экрана любого размера, на котором его может открыть пользователь. Этот подход последние годы стал, можно сказать, стандартом, мейнстримом. Все так делают. Большинство, вот - даже не понимая толком, а _что именно_ они делают. Давайте еще раз посмотрим на четкое определение адаптивного дизайна. Это система организации экранного пространства, которая:
* Определяется набором из **N > 0** контрольных точек - **брекпоинтов**, и **N + 1** построенных на них диапазонов отображения - **типоразмеров**;
* Для каждого из типоразмеров кроме наименьшего выбирается контейнер для контента шириной немного меньше значения начала диапазона. На наименьшем типоразмере - для мобильных устройств, смартфонов - контейнер занимает на всю ширину экрана;
* Типографика может меняться между типоразмерами, но не меняется на всем протяжении каждого такого диапазона.

Большая часть дизайнов которые вы видите сегодня - или адаптивные или хотя бы минимально **отзывчивые**, тоесть - реагируют на размер экрана который их показывает. Все эти подходы представлют собой, по сути, все тот же старый-добрый статичный подход, но чуть более гибко.

А каким еще может быть дизайн? В реальных проектах часто может подразумеваться что вы должны **отобразить макет на экране _пропорционально_**. Такой дизайн мы может определить как **резиновый**. Для того чтобы совсем наглядно это увидеть и понять можно поиграть с маштабом различных веб-страниц: те которые при маштабированни будут сильно меняться - это вариации статичного дизайна, те, которые при маштабировании менятся не будут совсем - это резиновые. Скроее всего резиновых дизайнов вы почти не встретите. А почему? Реализовать такой дизайн для браузера несколько сложнее и невероятно сложно если вы не будете применять продвинутый препроцессор, напрмиер, подходы к нему озвученные данным руководством. Я покажу как без особых усилий можно совместить и резиновую и адаптивную техники для мощнейшей эргономики экранного пространства. И в конце даже пойду еще дальше - покажу свежее решение, которое, в будущем, способно полностью заменить «костыльный» и трудозатратный адаптивный подход - резиновым со всего двумя типоразмерами [спойлер: основанными на пропорции, а не на ширине вьюпорта].

Но прежде чем перейти к коду для простого резинового отображения макетов давайте затронем еще один важный концептуальный момент. Кроме способа адаптации, по каким основным рамочным качествам еше можно класифицировать дизайны?

Дизайны бывают:
* **вертикальные** - когда подача информации осуществляется последовательными блоками, секциями расположенными, чаще всего, друг-над-другом, слоями [но может быть и горизонтально]. Такие дизайны **показывают общий скролл** на подавляющем большинстве своих страниц;
* **рабочий стол** - когда весь интерфейс приложения размещается на одном экране, **общий скролл отсутсвует**, хотя и может появляться для отдельных областей вьюпорта, _окон_.

На практике, я выяснил, что без подсказки многие дизайнеры не могут самостоятельно осознать простую мысль о том, что два прямоугольника с различными пропорциями невозможно пропорционально совместить, наложив друг-на друга. Ну просто _никак_. Если пропоции разные - у вас возникнет либо лишняя высота, либо ширина, при попытке вписать один прямоугольник в другой. Вертикальные дизайны легко можно реализовывать и через адаптивный и через резиновый подходы. «Рабочий стол» - возможно делать адаптивным, но вот с резиновой реализацией - возникнет проблема с разницей пропорций, между конкретным макетом - из «розового мира с единорожками», в котором любят пребывать дизайнеры - и реальной средой современных экранов которые могут быть практически любого размера и пропорции.

Мы можем уверенно отобразить макет пропорционально опираясь либо на относительную ширину, либо на относительную высоту вьюпорта - с помощью современных [относительных единиц](https://www.w3schools.com/cssref/css_units.asp). В случае вертикального дизайна нам нужно использовать относительную ширину, а в случае дизайна «рабочий стол» нам нужно решить что делать с лишней высотой или шириной...

Размеры экранов очень сильно различаются, но для мобильных и планшетных экранов разброс по размерам качественно скромнее чем для «всех остальных экранов», условно - декстопов. Поэтому для «не гаджетов» для максимальной эргономии, скорее всего, придется добавлять дополнительные похожие типоразмеры.

C другой стороны на гаджетах существует следующие специфические сложности:
* Проблемы с реальной высотой вьпорта и нативными панелями высота которых не учитывается;
* Огромная разница в пропоции у экранов мобильных устройств;
* Переворот.

В свете всего вышесказанного, сейчас, самым актуальным прогрессивным подходом представляется совмещение мобильного и планшетного адаптивных типоразмеров и хотя бы одного резинового декстопа. Такой метод способен сделать отображение на декстопах максимально адекватным и эргономичным, и при этом - избегает излишней сложности и проблем с реализацией для гаджетов.  

Давайте посмотрим как легко сделать это с помощью препроцессора, его переменных, функций и примесей, их композиций. Самое сложное для понимания - нам нужна некоторая переменная которая будет хранить **«резиновый пиксель»** - относительное значение через которое все соотношения в макетах будут транслироваться в верстке «пропорционально вьюпорту». Мы верстаем «относительно ширины», поэтому используем **vw**:

```scss
// В @/src/scss/utils/_variables.scss:
$rubber__width_pixel: 0.06 * 1vw;
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
    @include selector__rubber($rubber__width_pixel);
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

А теперь давайте чуть-чуть пофантазируем о будущем. Экраны уже сейчас такие разные по пропорциям и размеру. Можно ли гипотетически реализовывать резину годную для всех размеров и пропорций? На самом деле - можно. Представьте себе что у нас будет **всего 2 резиновых типоразмера - широкий и высокий**. Лейаут приложения с помощью джаваскрипта будет определять пропорцию вьюпорта и основываясь на ней - отдавать ту или иную, более адекватную композицию. Так мы сможем легко, абсолютно универсально и стабильно обслужить, например - переворот на любых гаджетах.

В заключении хочется добавить что все это - совершенно жизненные и реальные кейсы, которые уже не раз встречались мне в реальной коммерческой практике, на самых разных проектах. И без препроцессора такие случаи, запросы-требования просто практически невозможно быстро и надежно реализовывать.

## Resize Me

## Высота мобил

## Навигация c клавиатуры

## Компенсация скролла для модали

## Случай c айфонами, тагом picture и hook`ами на React

## Виды компонент и способы переиспользования логики в React

## Автоматически гидрируемое хранилище в React/Redux

## А чем крут Vue?

## JSX, ARIA, линтер и песочницы, PWA, сборка
