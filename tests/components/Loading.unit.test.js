import { mount } from '@vue/test-utils';
import Loading from '../../src/components/Loading.vue';

describe('Loading Component', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(Loading, {
      props: {
        visible: false
      }
    });
  });

  afterEach(() => {
    wrapper.unmount();
  });

  it('should not render when visible is false', () => {
    expect(wrapper.find('.loading-overlay').exists()).toBe(false);
  });

  it('should render when visible is true', async () => {
    await wrapper.setProps({ visible: true });
    await wrapper.vm.$nextTick();
    
    expect(wrapper.find('.loading-overlay').exists()).toBe(true);
    expect(wrapper.find('.loading-spinner').exists()).toBe(true);
  });

  it('should display default loading text', async () => {
    await wrapper.setProps({ visible: true });
    await wrapper.vm.$nextTick();
    
    expect(wrapper.find('.loading-text').text()).toBe('加载中...');
  });

  it('should display custom loading text', async () => {
    await wrapper.setProps({ visible: true, text: '处理中...' });
    await wrapper.vm.$nextTick();
    
    expect(wrapper.find('.loading-text').text()).toBe('处理中...');
  });

  it('should not display text when text prop is empty', async () => {
    await wrapper.setProps({ visible: true, text: '' });
    await wrapper.vm.$nextTick();
    
    expect(wrapper.find('.loading-text').exists()).toBe(false);
  });

  it('should have overlay class when fullscreen is true', async () => {
    await wrapper.setProps({ visible: true, fullscreen: true });
    await wrapper.vm.$nextTick();
    
    expect(wrapper.find('.loading-overlay').classes()).toContain('fullscreen');
  });

  it('should not have overlay class when fullscreen is false', async () => {
    await wrapper.setProps({ visible: true, fullscreen: false });
    await wrapper.vm.$nextTick();
    
    expect(wrapper.find('.loading-overlay').classes()).not.toContain('fullscreen');
  });

  it('should have small size class when size is small', async () => {
    await wrapper.setProps({ visible: true, size: 'small' });
    await wrapper.vm.$nextTick();
    
    expect(wrapper.find('.loading-spinner').classes()).toContain('spinner-small');
  });

  it('should have large size class when size is large', async () => {
    await wrapper.setProps({ visible: true, size: 'large' });
    await wrapper.vm.$nextTick();
    
    expect(wrapper.find('.loading-spinner').classes()).toContain('spinner-large');
  });
});