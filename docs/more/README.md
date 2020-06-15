# Препроцессор, JavaScript и фреймворки

Ого, вы еще читаете?!.. Отлично!

Во второй части пособия идеи и подходы станут менее спорными, так как мы просто разберем несколько жизненных и углубленных основных кейсов современного экранного дизайна. И если первые три темы будут наглядно использовать мощный и гибкий, но «достаточно спорный» подход к препроцессору, описанный в первой части трактата, то дальше речь пойдет уже сугубо об использовании javascript для GUI и доступности в контексте популярных реактивных фреймворков.

## Темезация

Очень часто встречающимся кейсом является темезация. Ваш заказчик вполне может захотеть чтобы светлый интерфейс продукта _ночью глаза клиентам не резал_. А вы _уже все сверстали_, пичалька...

Справедливости ради, нужно упомянуть что ссылка на пример с [темезацией на Styled Components с React и TypeScript](https://github.com/ushliypakostnik/react-auth/tree/master/src/theme) уже встречалась в тексте в самом конце рассказа о препроцессоре, когда разговор зашел о компонентности и несвязности, плюс это один из немногих кейсов, в котором использование просто самих Custom Properties кажется вполне эффективным. Готовые модули часто стали применять такой подход к кастомизации. Ну это явно получше чем тонна невменяемого CSS. О действительно уникальном кейсе когда «нативные переменные» оказываются единственным изящным выходом из сложной ситуации будет рассказано немного ниже. 

Давайте запилим все на [Vue c SCSS](https://github.com/ushliypakostnik/vue-scss-i18next/tree/master/src). Надеюсь что вы все поняли из первой части, и в вашем проекте цвсе вета дотошно абстрагированны в переменных стилевой базы. Иначе, конечно, _ничего не получится_.

Что мы должны добавить в проект в самую первую очередь? Как в случае стилей, это, по моему убеждению, должны быть глобальные переменные перпроцессора, **для javаscript нужно первым делом определить константы** которые будет использовать вся остальная система. Так как информацию о том, какую тему последний раз выбрал пользователь мы планируем хранить в Local Storage браузера (вы можете также использовать технологию cookies или Session Storage, в зависимости от ситуации), нужно создать поле для этого, а также определить сами темы - мы собираемся сделать дневную и ночную. В <code>@/src/utils/constans.js</code>:

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

Вся внутрення кухня для того чтобы менять тему готова и можно перейти к разметке. Так как цвета нужно менять даже для самой верхней обертки в GUI, класс модификатор распрастраняющий изменения по верстке мы будем выставлять «прямо на всем приложении», в главном шаблоне <code>@/src/App.vue</code> который использует <code>\<router-view /></code> роутера - точку в которой будет рендерить остальные компоненты, и основной файл <code>@/src/scss/_main.scss</code> собирающий стили. Подписываем этот компонент на геттер нужного поля стора:
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
      │  ├─ _theme-dark.scss
      │  ├─ _theme-light.scss
      │  └─ _themes-content.scss
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
// В @/src/scss/themes/_theme-dark.scss: 
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
// В @/src/scss/themes/_theme-light.scss: 
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

Такой подход способен сделать темезацию вашего интерфейса легким и приятным занятием. Код препроцессора не повторяется и остается максимально выразительным. Этот шикарный кейс еше раз подчеркивает что возможности глобальной абстракции стилей препроцессором оказываются крайне эффективны именно в грамотной связке с актуальными компонентными подходами. Каждый занимается своим делом. **Компонентность обслуживает функциональность, тогда как препроцессор занимается оформлением.**

## Деградация

## Резина

## Константы

## ScreenHelper

## Resize Me

## Высота мобил

## Навигация c клавиатуры

## Компенсация скролла для модали

## Случай c айфонами, тагом picture и hook`ами на React

## Классовые и функциональные компоненты, HOC в React

## Автоматическое хранилище в React/Redux

## А чем крут Vue?

## JSX, ARIA, линтер и песочницы, PWA, сборка
