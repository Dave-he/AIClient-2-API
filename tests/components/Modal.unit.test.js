import { mount } from '@vue/test-utils';
import Modal from '../../src/components/Modal.vue';

describe('Modal Component', () => {
  let wrapper;

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  it('should not render when visible is false', () => {
    wrapper = mount(Modal, {
      props: {
        visible: false,
        title: 'Test Modal'
      },
      slots: {
        default: '<p>Modal content</p>'
      }
    });
    
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('should render when visible is true', async () => {
    wrapper = mount(Modal, {
      props: {
        visible: true,
        title: 'Test Modal'
      },
      slots: {
        default: '<p>Modal content</p>'
      }
    });
    
    await wrapper.vm.$nextTick();
    
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
    expect(document.querySelector('.modal-content')).not.toBeNull();
  });

  it('should display title', async () => {
    wrapper = mount(Modal, {
      props: {
        visible: true,
        title: 'My Modal'
      },
      slots: {
        default: '<p>Content</p>'
      }
    });
    
    await wrapper.vm.$nextTick();
    
    const title = document.querySelector('.modal-title');
    expect(title.textContent.trim()).toBe('My Modal');
  });

  it('should display content from slot', async () => {
    wrapper = mount(Modal, {
      props: {
        visible: true,
        title: 'Test Modal'
      },
      slots: {
        default: '<p>Modal content</p>'
      }
    });
    
    await wrapper.vm.$nextTick();
    
    const body = document.querySelector('.modal-body');
    expect(body.innerHTML).toContain('<p>Modal content</p>');
  });

  it('should emit close event when overlay clicked', async () => {
    wrapper = mount(Modal, {
      props: {
        visible: true,
        title: 'Test Modal'
      },
      slots: {
        default: '<p>Content</p>'
      }
    });
    
    await wrapper.vm.$nextTick();
    
    const overlay = document.querySelector('.modal-overlay');
    overlay.click();
    await wrapper.vm.$nextTick();
    
    expect(wrapper.emitted('update:visible')).toBeTruthy();
    expect(wrapper.emitted('update:visible')[0]).toEqual([false]);
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('should emit close event when close button clicked', async () => {
    wrapper = mount(Modal, {
      props: {
        visible: true,
        title: 'Test Modal'
      },
      slots: {
        default: '<p>Content</p>'
      }
    });
    
    await wrapper.vm.$nextTick();
    
    const closeBtn = document.querySelector('.modal-close');
    closeBtn.click();
    await wrapper.vm.$nextTick();
    
    expect(wrapper.emitted('update:visible')).toBeTruthy();
    expect(wrapper.emitted('update:visible')[0]).toEqual([false]);
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('should not emit close when content clicked', async () => {
    wrapper = mount(Modal, {
      props: {
        visible: true,
        title: 'Test Modal'
      },
      slots: {
        default: '<p>Content</p>'
      }
    });
    
    await wrapper.vm.$nextTick();
    
    const content = document.querySelector('.modal-content');
    content.click();
    await wrapper.vm.$nextTick();
    
    expect(wrapper.emitted('update:visible')).toBeFalsy();
    expect(wrapper.emitted('close')).toBeFalsy();
  });

  it('should display icon when provided', async () => {
    wrapper = mount(Modal, {
      props: {
        visible: true,
        title: 'Test Modal',
        icon: 'fa-user'
      },
      slots: {
        default: '<p>Content</p>'
      }
    });
    
    await wrapper.vm.$nextTick();
    
    expect(document.querySelector('i.fa-user')).not.toBeNull();
  });

  it('should render footer slot', async () => {
    wrapper = mount(Modal, {
      props: {
        visible: true,
        title: 'Test Modal'
      },
      slots: {
        default: '<p>Content</p>',
        footer: '<button class="test-btn">OK</button>'
      }
    });
    
    await wrapper.vm.$nextTick();
    
    expect(document.querySelector('.modal-footer')).not.toBeNull();
    expect(document.querySelector('.test-btn')).not.toBeNull();
  });

  it('should apply large size class', async () => {
    wrapper = mount(Modal, {
      props: {
        visible: true,
        title: 'Test Modal',
        size: 'large'
      },
      slots: {
        default: '<p>Content</p>'
      }
    });
    
    await wrapper.vm.$nextTick();
    
    const modalContent = document.querySelector('.modal-content');
    expect(modalContent.classList.contains('modal-large')).toBe(true);
  });

  it('should prevent close when closable is false', async () => {
    wrapper = mount(Modal, {
      props: {
        visible: true,
        title: 'Test Modal',
        closable: false
      },
      slots: {
        default: '<p>Content</p>'
      }
    });
    
    await wrapper.vm.$nextTick();
    
    const closeBtn = document.querySelector('.modal-close');
    closeBtn.click();
    await wrapper.vm.$nextTick();
    
    expect(wrapper.emitted('update:visible')).toBeFalsy();
  });
});