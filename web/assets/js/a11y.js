// Screen reader and keyboard support for the ant-design-vue 1.x components the
// panel is built from. The components are adjusted once here, so every page
// and every icon antd draws by itself gets the same behavior:
// - icons are no longer read as "icon: <type>"; decorative ones are hidden,
// - clickable icons and tags are buttons: focusable and usable with Enter/Space,
// - clickable icons and buttons with only an icon are named after the icon,
// - a tooltip around a nameless button or icon names it,
// - dropdowns and popconfirms opened from the keyboard can be used with it.
// Names come from aria-label when the template gives one, then the tooltip,
// then a11yIconLabels (icon type -> translated name, set by the page).

(function () {
    const iconLabels = typeof a11yIconLabels === 'undefined' ? {} : a11yIconLabels;
    const components = Vue.options.components;

    // An attribute marking names given here, which a tooltip may replace.
    const autoName = 'data-a11y-name';

    function onActivateKey(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.currentTarget.click();
        }
    }

    function withListener(on, name, listener) {
        const merged = Object.assign({}, on);
        merged[name] = on && on[name] ? [].concat(on[name], listener) : listener;
        return merged;
    }

    function describeIcon(vm, vnode) {
        if (!vnode || !vnode.data) {
            return vnode;
        }
        const attrs = vnode.data.attrs = Object.assign({}, vnode.data.attrs);
        const name = vm.$attrs['aria-label'];
        if (vm.$listeners.click) {
            attrs.role = 'button';
            if (attrs.tabIndex === -1) {
                attrs.tabIndex = 0;
            }
            attrs['aria-label'] = name || iconLabels[vm.type];
            if (!name) {
                attrs[autoName] = '';
            }
            vnode.data.on = withListener(vnode.data.on, 'keydown', onActivateKey);
        } else if (name) {
            attrs.role = 'img';
            attrs['aria-label'] = name;
        } else {
            delete attrs['aria-label'];
            attrs['aria-hidden'] = 'true';
        }
        // An undefined tabIndex makes Vue remove the attribute on every
        // update, also the one a popup trigger below gives the icon.
        if (attrs.tabIndex === undefined) {
            delete attrs.tabIndex;
        }
        return vnode;
    }

    // AIcon renders its <i> inside a LocaleReceiver slot.
    const Icon = components.AIcon.options;
    const iconRender = Icon.render;
    Icon.render = function (h) {
        const vnode = iconRender.call(this, h);
        const slot = vnode.data.scopedSlots.default;
        vnode.data.scopedSlots.default = locale => describeIcon(this, slot(locale));
        return vnode;
    };

    // Buttons antd draws with only an icon, like the alert's close button.
    function nameIconButton() {
        const parent = this.$el && this.$el.parentElement;
        const name = iconLabels[this.type];
        if (name && parent && parent.matches('button, a') && isNameless(parent)) {
            parent.setAttribute('aria-label', name);
            parent.setAttribute(autoName, '');
        }
    }
    Icon.mounted = [].concat(Icon.mounted || [], nameIconButton);

    // A tag with a click handler, like Stop or Logs on the overview.
    function tagAsButton() {
        const el = this.$el;
        if (this.$listeners.click && el && el.nodeType === 1 && !el.hasAttribute('role')) {
            el.setAttribute('role', 'button');
            el.tabIndex = 0;
            el.addEventListener('keydown', onActivateKey);
        }
    }
    const Tag = components.ATag.options;
    Tag.mounted = [].concat(Tag.mounted || [], tagAsButton);
    Tag.updated = [].concat(Tag.updated || [], tagAsButton);

    const popups = '.ant-popover:not(.ant-popover-hidden), .ant-dropdown:not(.ant-dropdown-hidden)';

    // Keys inside a popup opened from the keyboard: Escape closes it, and
    // after a button or menu item closes it focus goes back to its trigger.
    function onPopupKey(event) {
        const popup = event.currentTarget;
        const trigger = popup.a11yTrigger;
        if (!trigger) {
            return;
        }
        if (event.key === 'Escape') {
            trigger.click();
            trigger.focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
            const restore = () => {
                const active = document.activeElement;
                if (!active || active === document.body || popup.contains(active)) {
                    trigger.focus();
                }
            };
            // Listening before the menu runs the item's action, which may
            // open a modal that later returns focus where it was; a button
            // runs its action after keydown.
            if (popup.querySelector('.ant-dropdown-menu')) {
                restore();
            } else {
                setTimeout(restore);
            }
        }
    }

    // Antd opens these popups at the end of the page, so after opening one
    // from the keyboard focus goes to its buttons or menu.
    function focusPopup(trigger, tries) {
        const popup = [...document.querySelectorAll(popups)].pop();
        const target = popup && popup.querySelector('.ant-popover-buttons .ant-btn, .ant-dropdown-menu');
        if (target) {
            if (!popup.a11yTrigger) {
                popup.addEventListener('keydown', onPopupKey, true);
            }
            popup.a11yTrigger = trigger;
            target.focus();
        } else if (tries > 0) {
            setTimeout(() => focusPopup(trigger, tries - 1), 50);
        }
    }

    // An icon opening a popconfirm or a dropdown gets its click handler from
    // them, so it isn't marked as a button while rendering.
    function iconTriggerAsButton(el) {
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        el.removeAttribute('aria-hidden');
        el.addEventListener('keydown', onActivateKey);
        const type = (el.className.match(/\banticon-(?!spin\b)([\w-]+)/) || [])[1];
        if (!el.getAttribute('aria-label') && iconLabels[type]) {
            el.setAttribute('aria-label', iconLabels[type]);
            el.setAttribute(autoName, '');
        }
    }

    function popupTrigger() {
        const el = this.$el;
        if (!el || el.nodeType !== 1 || el.a11yPopupTrigger) {
            return;
        }
        el.a11yPopupTrigger = true;
        if (el.matches('.anticon') && el.getAttribute('role') !== 'button') {
            iconTriggerAsButton(el);
        }
        el.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                setTimeout(() => focusPopup(el, 10), 50);
            }
        });
    }
    ['APopconfirm', 'ADropdown'].forEach(name => {
        const trigger = components[name].options;
        trigger.mounted = [].concat(trigger.mounted || [], popupTrigger);
        trigger.updated = [].concat(trigger.updated || [], popupTrigger);
    });

    function hasText(nodes) {
        return (nodes || []).some(node => {
            if (!node.tag) {
                return !!(node.text && node.text.trim());
            }
            if (node.componentOptions) {
                return node.componentOptions.tag !== 'a-icon';
            }
            return hasText(node.children);
        });
    }

    function slotIcon(nodes) {
        const icon = (nodes || []).find(node => node.componentOptions && node.componentOptions.tag === 'a-icon');
        return icon && icon.componentOptions.propsData.type;
    }

    const Button = components.AButton.options;
    const buttonRender = Button.render;
    Button.render = function (h) {
        const vnode = buttonRender.call(this, h);
        if (vnode && vnode.data && !this.$attrs['aria-label'] && !hasText(this.$slots.default)) {
            const name = iconLabels[this.icon || slotIcon(this.$slots.default)];
            if (name) {
                vnode.data.attrs = Object.assign({}, vnode.data.attrs, { 'aria-label': name, [autoName]: '' });
            }
        }
        return vnode;
    };

    function vnodeText(nodes) {
        return (nodes || []).map(node => {
            if (!node.tag) {
                return node.text || '';
            }
            return vnodeText(node.children || (node.componentOptions && node.componentOptions.children));
        }).join(' ');
    }

    function tooltipText(vm) {
        const title = typeof vm.title === 'string' ? vm.title : vnodeText(vm.$slots.title || vm.title);
        return (title || '').replace(/\s+/g, ' ').trim();
    }

    function isNameless(el) {
        if (el.hasAttribute(autoName)) {
            return true;
        }
        return !el.getAttribute('aria-label') && !el.textContent.trim();
    }

    // The tooltip's text names the element it wraps when that element is a
    // control without a name of its own, or a lone icon carrying information.
    // Tooltips antd uses inside popovers and popconfirms are left alone.
    function nameByTooltip() {
        if (/^A[A-Z]/.test(this.$vnode.context.$options.name || '')) {
            return;
        }
        const el = this.$el;
        const text = el && el.nodeType === 1 && tooltipText(this);
        if (!text) {
            return;
        }
        if (el.matches('button, a, [role="button"]') && isNameless(el)) {
            el.setAttribute('aria-label', text);
        } else if (el.matches('.anticon[aria-hidden]')) {
            el.removeAttribute('aria-hidden');
            el.setAttribute('role', 'img');
            el.setAttribute('aria-label', text);
        }
    }

    const Tooltip = components.ATooltip.options;
    Tooltip.mounted = [].concat(Tooltip.mounted || [], nameByTooltip);
    Tooltip.updated = [].concat(Tooltip.updated || [], nameByTooltip);
})();
