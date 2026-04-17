import { mount } from '@vue/test-utils';
import Toast from '../../src/components/Toast.vue';

describe('Toast Component', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(Toast);
  });

  afterEach(() => {
    wrapper.unmount();
  });

  it('should render empty initially', () => {
    expect(wrapper.find('.toast-container').exists()).toBe(true);
    expect(wrapper.findAll('.toast').length).toBe(0);
  });

  it('should show success toast', async () => {
    wrapper.vm.success('Test success message');
    await wrapper.vm.$nextTick();
    
    const toast = wrapper.find('.toast');
    expect(toast.exists()).toBe(true);
    expect(toast.classes()).toContain('success');
    expect(toast.find('.toast-message').text()).toBe('Test success message');
    expect(toast.find('i.fa-check-circle').exists()).toBe(true);
  });

  it('should show error toast', async () => {
    wrapper.vm.error('Test error message');
    await wrapper.vm.$nextTick();
    
    const toast = wrapper.find('.toast');
    expect(toast.exists()).toBe(true);
    expect(toast.classes()).toContain('error');
    expect(toast.find('.toast-message').text()).toBe('Test error message');
    expect(toast.find('i.fa-exclamation-circle').exists()).toBe(true);
  });

  it('should show warning toast', async () => {
    wrapper.vm.warning('Test warning message');
    await wrapper.vm.$nextTick();
    
    const toast = wrapper.find('.toast');
    expect(toast.exists()).toBe(true);
    expect(toast.classes()).toContain('warning');
    expect(toast.find('.toast-message').text()).toBe('Test warning message');
    expect(toast.find('i.fa-exclamation-triangle').exists()).toBe(true);
  });

  it('should show info toast', async () => {
    wrapper.vm.info('Test info message');
    await wrapper.vm.$nextTick();
    
    const toast = wrapper.find('.toast');
    expect(toast.exists()).toBe(true);
    expect(toast.classes()).toContain('info');
    expect(toast.find('.toast-message').text()).toBe('Test info message');
    expect(toast.find('i.fa-info-circle').exists()).toBe(true);
  });

  it('should remove toast when clicked', async () => {
    wrapper.vm.success('Test message');
    await wrapper.vm.$nextTick();
    
    const toast = wrapper.find('.toast');
    expect(toast.exists()).toBe(true);
    
    await toast.trigger('click');
    await wrapper.vm.$nextTick();
    
    expect(wrapper.findAll('.toast').length).toBe(0);
  });

  it('should remove toast when close button clicked', async () => {
    wrapper.vm.success('Test message');
    await wrapper.vm.$nextTick();
    
    const closeBtn = wrapper.find('.toast-close');
    expect(closeBtn.exists()).toBe(true);
    
    await closeBtn.trigger('click');
    await wrapper.vm.$nextTick();
    
    expect(wrapper.findAll('.toast').length).toBe(0);
  });

  it('should auto dismiss toast after duration', async () => {
    jest.useFakeTimers();
    
    wrapper.vm.success('Test message', 1000);
    await wrapper.vm.$nextTick();
    
    expect(wrapper.find('.toast').exists()).toBe(true);
    
    jest.advanceTimersByTime(1000);
    await wrapper.vm.$nextTick();
    
    expect(wrapper.findAll('.toast').length).toBe(0);
    
    jest.useRealTimers();
  });

  it('should show multiple toasts', async () => {
    wrapper.vm.success('First message');
    wrapper.vm.error('Second message');
    await wrapper.vm.$nextTick();
    
    expect(wrapper.findAll('.toast').length).toBe(2);
  });
});