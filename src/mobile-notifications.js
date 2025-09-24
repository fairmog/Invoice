/**
 * Mobile-Friendly Notification and Modal System
 * Replaces popup-blocked alert(), confirm(), prompt(), and window.open()
 */

class MobileNotifications {
    constructor() {
        this.toastQueue = [];
        this.activeModal = null;
        this.init();
    }

    init() {
        // Create toast container
        this.createToastContainer();
        // Create modal overlay
        this.createModalOverlay();
        // Add CSS styles
        this.addStyles();
    }

    createToastContainer() {
        if (document.getElementById('toast-container')) return;

        // Check if document.body exists
        if (!document.body) {
            // If DOM not ready, wait for it
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.createToastContainer();
                });
                return;
            } else {
                // DOM is complete but body doesn't exist - this shouldn't happen
                console.error('Document ready but body not found');
                return;
            }
        }

        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    createModalOverlay() {
        if (document.getElementById('modal-overlay')) return;

        // Check if document.body exists
        if (!document.body) {
            // If DOM not ready, wait for it
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.createModalOverlay();
                });
                return;
            } else {
                // DOM is complete but body doesn't exist - this shouldn't happen
                console.error('Document ready but body not found');
                return;
            }
        }

        const overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.className = 'modal-overlay';
        overlay.style.display = 'none';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        overlay.appendChild(modalContent);

        document.body.appendChild(overlay);

        // Close modal when clicking overlay (not content)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeModal();
            }
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.closeModal();
            }
        });
    }

    addStyles() {
        if (document.getElementById('mobile-notification-styles')) return;

        const style = document.createElement('style');
        style.id = 'mobile-notification-styles';
        style.textContent = `
            /* Toast Notifications */
            .toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
                max-width: 400px;
                width: 100%;
            }

            @media (max-width: 480px) {
                .toast-container {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
            }

            .toast {
                background: #fff;
                border-radius: 8px;
                padding: 16px 20px;
                margin-bottom: 10px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                border-left: 4px solid #007bff;
                pointer-events: auto;
                transform: translateX(400px);
                opacity: 0;
                transition: all 0.3s ease-in-out;
                position: relative;
                word-wrap: break-word;
                max-width: 100%;
            }

            .toast.show {
                transform: translateX(0);
                opacity: 1;
            }

            .toast.hide {
                transform: translateX(400px);
                opacity: 0;
            }

            .toast.success { border-left-color: #28a745; background: #f8fff9; }
            .toast.error { border-left-color: #dc3545; background: #fff8f8; }
            .toast.warning { border-left-color: #ffc107; background: #fffdf5; }
            .toast.info { border-left-color: #17a2b8; background: #f7feff; }

            .toast-content {
                display: flex;
                align-items: flex-start;
                gap: 10px;
            }

            .toast-icon {
                font-size: 18px;
                flex-shrink: 0;
                margin-top: 1px;
            }

            .toast-message {
                flex: 1;
                color: #333;
                line-height: 1.4;
                font-size: 14px;
            }

            .toast-close {
                position: absolute;
                top: 8px;
                right: 12px;
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #999;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .toast-close:hover {
                color: #666;
            }

            /* Modal System */
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                box-sizing: border-box;
                opacity: 0;
                transition: opacity 0.3s ease-in-out;
            }

            .modal-overlay.show {
                opacity: 1;
            }

            .modal-content {
                background: #fff;
                border-radius: 12px;
                padding: 24px;
                max-width: 500px;
                width: 100%;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
                transform: scale(0.8);
                transition: transform 0.3s ease-in-out;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            }

            .modal-overlay.show .modal-content {
                transform: scale(1);
            }

            .modal-header {
                margin-bottom: 20px;
            }

            .modal-title {
                font-size: 18px;
                font-weight: 600;
                color: #333;
                margin: 0;
            }

            .modal-message {
                color: #666;
                line-height: 1.5;
                margin-bottom: 24px;
                font-size: 14px;
            }

            .modal-input {
                width: 100%;
                padding: 12px 16px;
                border: 2px solid #e0e0e0;
                border-radius: 6px;
                font-size: 14px;
                margin-bottom: 20px;
                transition: border-color 0.2s;
                box-sizing: border-box;
            }

            .modal-input:focus {
                outline: none;
                border-color: #007bff;
            }

            .modal-buttons {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                flex-wrap: wrap;
            }

            .modal-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                min-width: 80px;
                transition: all 0.2s;
                touch-action: manipulation;
                -webkit-appearance: none;
            }

            .modal-btn:active {
                transform: scale(0.98);
            }

            .modal-btn.primary {
                background: #007bff;
                color: white;
            }

            .modal-btn.primary:hover:not(:disabled) {
                background: #0056b3;
            }

            .modal-btn.secondary {
                background: #f8f9fa;
                color: #666;
                border: 1px solid #dee2e6;
            }

            .modal-btn.secondary:hover:not(:disabled) {
                background: #e2e6ea;
            }

            .modal-btn.success {
                background: #28a745;
                color: white;
            }

            .modal-btn.success:hover:not(:disabled) {
                background: #1e7e34;
            }

            .modal-btn.danger {
                background: #dc3545;
                color: white;
            }

            .modal-btn.danger:hover:not(:disabled) {
                background: #c82333;
            }

            .modal-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            @media (max-width: 480px) {
                .modal-content {
                    margin: 10px;
                    padding: 20px;
                    max-height: 90vh;
                }

                .modal-buttons {
                    flex-direction: column;
                }

                .modal-btn {
                    min-height: 44px;
                    font-size: 16px;
                }

                .toast {
                    font-size: 16px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Toast Notification Methods
    showToast(message, type = 'info', duration = 5000) {
        const toast = this.createToast(message, type, duration);
        const container = document.getElementById('toast-container');
        container.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 50);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => this.removeToast(toast), duration);
        }

        return toast;
    }

    createToast(message, type, duration) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icons[type] || icons.info}</span>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" type="button">&times;</button>
        `;

        // Close button functionality
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.removeToast(toast);
        });

        return toast;
    }

    removeToast(toast) {
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    // Convenience methods for different toast types
    success(message, duration = 5000) {
        return this.showToast(message, 'success', duration);
    }

    error(message, duration = 7000) {
        return this.showToast(message, 'error', duration);
    }

    warning(message, duration = 6000) {
        return this.showToast(message, 'warning', duration);
    }

    info(message, duration = 5000) {
        return this.showToast(message, 'info', duration);
    }

    // Modal Dialog Methods
    showModal(options = {}) {
        const {
            title = '',
            message = '',
            type = 'info',
            buttons = [],
            input = null,
            closeOnOverlay = true
        } = options;

        return new Promise((resolve, reject) => {
            const overlay = document.getElementById('modal-overlay');
            const content = overlay.querySelector('.modal-content');

            // Build modal content
            let modalHTML = '';

            if (title) {
                modalHTML += `
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                    </div>
                `;
            }

            if (message) {
                modalHTML += `<div class="modal-message">${message}</div>`;
            }

            if (input) {
                modalHTML += `
                    <input type="${input.type || 'text'}"
                           class="modal-input"
                           id="modal-input"
                           placeholder="${input.placeholder || ''}"
                           value="${input.value || ''}"
                           ${input.required ? 'required' : ''}>
                `;
            }

            if (buttons.length > 0) {
                modalHTML += '<div class="modal-buttons">';
                buttons.forEach((button, index) => {
                    modalHTML += `
                        <button class="modal-btn ${button.class || 'secondary'}"
                                data-index="${index}"
                                ${button.disabled ? 'disabled' : ''}>
                            ${button.text}
                        </button>
                    `;
                });
                modalHTML += '</div>';
            }

            content.innerHTML = modalHTML;

            // Add button click handlers
            content.querySelectorAll('.modal-btn').forEach((btn, index) => {
                btn.addEventListener('click', () => {
                    const inputElement = document.getElementById('modal-input');
                    const inputValue = inputElement ? inputElement.value : null;

                    this.closeModal();
                    resolve({
                        buttonIndex: index,
                        button: buttons[index],
                        input: inputValue
                    });
                });
            });

            // Handle input enter key
            const inputElement = content.querySelector('#modal-input');
            if (inputElement) {
                inputElement.focus();
                inputElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const primaryBtn = content.querySelector('.modal-btn.primary');
                        if (primaryBtn && !primaryBtn.disabled) {
                            primaryBtn.click();
                        }
                    }
                });
            }

            // Show modal
            overlay.style.display = 'flex';
            setTimeout(() => overlay.classList.add('show'), 50);

            this.activeModal = { resolve, reject, overlay };

            // Focus first button if no input
            if (!inputElement) {
                const firstBtn = content.querySelector('.modal-btn');
                if (firstBtn) firstBtn.focus();
            }
        });
    }

    closeModal() {
        if (!this.activeModal) return;

        const { overlay } = this.activeModal;
        overlay.classList.remove('show');

        setTimeout(() => {
            overlay.style.display = 'none';
            this.activeModal = null;
        }, 300);
    }

    // Replacement methods for native dialogs
    alert(message, title = '') {
        return this.showModal({
            title: title,
            message: message,
            buttons: [
                { text: 'OK', class: 'primary' }
            ]
        });
    }

    confirm(message, title = 'Confirm') {
        return this.showModal({
            title: title,
            message: message,
            buttons: [
                { text: 'Cancel', class: 'secondary' },
                { text: 'OK', class: 'primary' }
            ]
        }).then(result => result.buttonIndex === 1);
    }

    prompt(message, defaultValue = '', title = 'Input Required') {
        return this.showModal({
            title: title,
            message: message,
            input: {
                type: 'text',
                value: defaultValue,
                placeholder: 'Enter value...'
            },
            buttons: [
                { text: 'Cancel', class: 'secondary' },
                { text: 'OK', class: 'primary' }
            ]
        }).then(result => {
            return result.buttonIndex === 1 ? result.input : null;
        });
    }

    // Special method for payment redirects
    confirmPaymentRedirect(paymentUrl, message = 'You will be redirected to complete your payment.') {
        return this.showModal({
            title: 'Payment Redirect',
            message: message,
            buttons: [
                { text: 'Cancel', class: 'secondary' },
                { text: 'Continue to Payment', class: 'primary' }
            ]
        }).then(result => {
            if (result.buttonIndex === 1) {
                window.location.href = paymentUrl;
                return true;
            }
            return false;
        });
    }

    // Clear all notifications and modals
    clearAll() {
        const container = document.getElementById('toast-container');
        if (container) {
            container.innerHTML = '';
        }

        if (this.activeModal) {
            this.closeModal();
        }
    }
}

// Create global instance when DOM and body are ready
function initMobileNotifications() {
    if (document.body) {
        window.mobileNotifications = new MobileNotifications();
    } else {
        // Wait a bit and try again
        setTimeout(initMobileNotifications, 10);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNotifications);
} else {
    initMobileNotifications();
}

// Global convenience functions
window.showToast = (message, type, duration) => window.mobileNotifications?.showToast(message, type, duration);
window.showSuccess = (message, duration) => window.mobileNotifications?.success(message, duration);
window.showError = (message, duration) => window.mobileNotifications?.error(message, duration);
window.showWarning = (message, duration) => window.mobileNotifications?.warning(message, duration);
window.showInfo = (message, duration) => window.mobileNotifications?.info(message, duration);

// Enhanced alert/confirm/prompt replacements
window.mobileAlert = (message, title) => window.mobileNotifications?.alert(message, title);
window.mobileConfirm = (message, title) => window.mobileNotifications?.confirm(message, title);
window.mobilePrompt = (message, defaultValue, title) => window.mobileNotifications?.prompt(message, defaultValue, title);
