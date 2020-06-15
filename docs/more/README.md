# Препроцессор, JavaScript и фреймворки

Ого, вы еще читаете?!.. Отлично!

Во второй части пособия идеи и подходы станут менее скандальными, так как мы просто разберем несколько жизненных и углубленных основных кейсов современного экранного дизайна. И если в поначалу темы будут еще наглядно применять мощный и гибкий, но «достаточно спорный» подход к препроцессору, описанный в первой части трактата, то дальше речь пойдет уже сугубо об использовании javascript для GUI и доступности в контексте популярных реактивных фреймворков.

## Темезация

Очень часто встречающимся кейсом является темезация. Ваш заказчик вполне может захотеть чтобы светлый интерфейс продукта _ночью глаза клиентам не резал_. А вы _уже все сверстали_, пичалька...

Справедливости ради, нужно упомянуть что ссылка на пример с [темезацией на Styled Components с React и TypeScript](https://github.com/ushliypakostnik/react-auth/tree/master/src/theme) уже встречалась в тексте в самом конце рассказа о препроцессоре, когда разговор зашел о компонентности и несвязности, плюс это один из немногих кейсов, в котором использование просто самих Custom Properties кажется вполне эффективным. Готовые модули часто стали применять такой подход к кастомизации. Ну это явно получше чем тонна невменяемого CSS. О действительно уникальном кейсе когда «нативные переменные» оказываются единственным изящным выходом из сложной ситуации будет рассказано немного ниже. 

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

Теперь нам нужен препроцессор который будет уметь вести себя «как хамелеон» и «спускать через переменные» правильную кастомизацию всему заинтересованному в этом оформлению, разметке. Добавим в препроцессор отдельную папку для темезации <code>@/src/scss/themes/</code>, подключим файлы из нее в главном:

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

Мы используем общую для обоих тем «примесь-хамелеон», которая, компилируясь в нужном контексте, раздаеть правильный набор значений только той части разметки, которой необходима темезация. Тут мы как раз используем наше супермощное абстрактное связывание. Если что-то меняет оформление в зависимости от темы - связываем по селектору с модификатором темы. Мы делаем только одно отступление от уже озвученной в первой части пособия методы - несмотря на то, что это явно паттерн «воздействующий повсеместно на компоненты-виджеты-элементы через модификатор внешней обертки» - добавляем темезируемое оформление в общей примеси для модификаторов, а не в компонентах и виджетах. Потому, кажется, что тут просто так удобнее. С другой стороны, легко можно представить, как точно тоже самое можно сделать и «дисперсно-компонентно», размечая специфические стилизации для каждого компонента или виджета-элемента в его композиции. Как вам удобнее.

Такой подход способен сделать темезацию вашего интерфейса легким и приятным занятием. Код препроцессора не повторяется и остается максимально выразительным. Этот шикарный кейс еше раз подчеркивает что возможности глобальной абстракции стилей препроцессором оказываются крайне эффективны именно в грамотной связке с актуальными компонентными подходами. Каждый занимается своим делом. **Компонентный фреймворк обслуживает функциональность, тогда как препроцессор занимается оформлением.**

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

Кейсов в которых удобно вводить константы на уровне компонента также много, но они достаточно частные. Поэтому я покажу только один важный кейс, который напрямую связан с озвученными выше подходами к разметке и композиции селекторов. Вспомним наш самый распрастранненный паттерн «рядовое переиспользование модуля в отдельном конкретном виде». Посмотрим как это будет на React. 

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

Некая вьюха которая его переиспользует:
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

Для разметки конкретных уникальных видов кажется вполне оправданным использовать идентефикатор - по спецификации - то, что точно присутствует на странице в единственном экземпляре.

### Утилитарные модули

В даже минимально сложных разветвленных проектах между конфигурацией и логикой в компонентах удобно сформировать еще один слой утилитарных переиспользуемых модулей со стандартной функциональностью. Это например функции-валидадоты, модуль стандартизирующий взаимодействие по API, модуль взаимодействующий с браузерным хранилищем, конфигурация переводчика. Очень удобно выделить в отдельный модуль все функции которые нужны для взаимодействия с экраном и GUI - ведь одних только значений брекпоинтов и скорости анимации в константах явно недостаточно - нужно еще и нечто способное разнообразно и эффективно с этим работать, и чему вы сможете добавлять функционал по необходимости - в <code>@/src/utils/screen-helper.js</code>: 

```javascript
// В @/src/utils/screen-helper.js:
import { DESIGN } from '@/utils/constants';

// Модуль экранный помощник
const ScreenHelper = (() => {
  /* eslint-disable no-unused-vars */
  const NAME = 'ScreenHelper';

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

Обратите внимание - десктопные браузеры имеют разную ширину основного скроллбара - от нулевой прозрачной, до, возможно, даже некой специфической, кастомизированной через CSS для webkit. Поэтому если вашему javascript потребуется сравнить значение <code>document.documentElement.clientWidth</code> со специфическим нестандартным брекпоинтом которого нет в константах и <code>ScreenHelper</code>, но вы не хотите его добавлять - скрипт будет ошибаться на ненулевую ширину в части просмотрщиков. В таких случаях необходимо использовать уточняющую логику:

```javascript
const BREAKPOINT = 1234;

if (document.documentElement.clientWidth < BREAKPOINT - ScreenHelper.getScrollbarWidth()) {
  // Логика для экранов с шириной меньше 1234px
}
```

Но **никогда** не делайте так в обработчике на скролл - зажмет нахрен!) Ширина скролла это в принципе такая вещь, которую стоит учитывать в хорошем адаптивном веб-дизайне, но приемлимо - вычислить и записать один раз. Если это классовый компонент React, то: 

```jsx harmony
// В @/src/components/layout/Layout.jsx:
import React, { PureComponent } from "react";

class Component extends PureComponent {
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
      // Разметка компонента
    );
  };
};

export default Component;
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

// Ленивые роуты
const Main = lazy(() => import('../../views/Main'));
const View2 = lazy(() => import('../../views/View2'));
const View3 = lazy(() => import('../../views/View3'));

import Header from './Header';

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

## Деградация

## Резина

## Resize Me

## Высота мобил

## Навигация c клавиатуры

## Компенсация скролла для модали

## Случай c айфонами, тагом picture и hook`ами на React

## Виды компонент и Способы переиспользования логики в React

## Автоматически гидрируемое хранилище в React/Redux

## А чем крут Vue?

## JSX, ARIA, линтер и песочницы, PWA, сборка
