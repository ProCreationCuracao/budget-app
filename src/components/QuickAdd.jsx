// src/components/QuickAdd.jsx
import React, { useState, useEffect } from 'react';
import {
  Button,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  useDisclosure,
  useToast,
  VStack,
  HStack,
  Box
} from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import { supabase } from '../supabaseClient';

export default function QuickAdd({ onDone }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Form state
  const [type, setType] = useState('expense');
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // Load accounts & categories
  useEffect(() => {
    supabase
      .from('accounts')
      .select('id,name')
      .then(({ data }) => setAccounts(data || []));
    supabase
      .from('categories')
      .select('id,name')
      .then(({ data }) => setCategories(data || []));
  }, []);

  const reset = () => {
    setType('expense');
    setAccountId('');
    setCategory('');
    setLabel('');
    setAmount('');
    setNote('');
    setPaymentType('');
    setPhotoUrl('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accountId || !amount) {
      toast({ title: 'Account and amount required', status: 'error' });
      return;
    }
    setLoading(true);
    const payload = {
      type,
      account_id: accountId,
      category_id: category || null,
      label: label || null,
      amount: parseFloat(amount),
      note: note || null,
      payment_type: paymentType || null,
      photo_url: photoUrl || null,
      transaction_date: new Date().toISOString()
    };
    const { error } = await supabase
      .from('transactions')
      .insert([payload]);
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, status: 'error' });
    } else {
      toast({ title: 'Added!', status: 'success' });
      reset();
      onClose();
      onDone?.();
    }
  };

  return (
    <>
      <IconButton
        icon={<FiPlus />}
        colorScheme="teal"
        onClick={onOpen}
        aria-label="Quick Add"
        position="fixed"
        bottom="4"
        right="4"
        borderRadius="full"
        size="lg"
        boxShadow="md"
      />
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Quick Add Transaction</ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleSubmit}>
            <ModalBody>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>Type</FormLabel>
                  <Select value={type} onChange={e => setType(e.target.value)}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="transfer">Transfer</option>
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Account</FormLabel>
                  <Select
                    placeholder="Select account"
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </Select>
                </FormControl>

                <HStack width="100%" spacing={2}>
                  <FormControl flex={1}>
                    <FormLabel>Category</FormLabel>
                    <Select
                      placeholder="Category"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl flex={1}>
                    <FormLabel>Label</FormLabel>
                    <Input
                      placeholder="e.g. Walmart"
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                    />
                  </FormControl>
                </HStack>

                <FormControl isRequired>
                  <FormLabel>Amount</FormLabel>
                  <Input
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Note</FormLabel>
                  <Textarea
                    placeholder="Any comments…"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Payment Type</FormLabel>
                  <Select
                    placeholder="Cash, Card, etc."
                    value={paymentType}
                    onChange={e => setPaymentType(e.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="online">Online</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Photo URL</FormLabel>
                  <Input
                    placeholder="Image URL"
                    value={photoUrl}
                    onChange={e => setPhotoUrl(e.target.value)}
                  />
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button onClick={onClose} mr={3}>Cancel</Button>
              <Button
                colorScheme="teal"
                type="submit"
                isLoading={loading}
              >
                Add
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
